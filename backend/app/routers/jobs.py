import uuid
from pathlib import Path

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile,
)
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import config
from ..database import get_db
from ..models import Job, JobStatus
from ..schemas import (
    AnalysisOut, AnalysisSettings, JobOut, JobResultOut, RepAssignment,
    SpeakerOut, UtteranceOut, UtteranceVoiceOut, VersionOut, VoiceStatusOut,
)
from ..services.pipeline import run_pipeline, run_reanalysis
from ..services.voice_features import public_view
from ..services.voice_store import load_signals

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

ALLOWED_EXTENSIONS = {".m4a", ".mp3"}
MEDIA_TYPES = {".m4a": "audio/mp4", ".mp3": "audio/mpeg"}
BUSY = {"queued", "transcribing", "analysing"}
CHUNK_SIZE = 1024 * 1024


def _looks_like_audio(head: bytes, ext: str) -> bool:
    """Cheap magic-byte check so a renamed .exe/.pdf is rejected."""
    if ext == ".m4a":
        return head[4:8] == b"ftyp"
    if ext == ".mp3":
        return head[:3] == b"ID3" or (len(head) > 1 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0)
    return False


@router.post("", response_model=JobOut, status_code=201)
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    analysis_settings: str | None = Form(None, alias="settings"),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(415, "Unsupported file type. Please upload a .m4a or .mp3 file.")

    try:
        settings = (
            AnalysisSettings.model_validate_json(analysis_settings)
            if analysis_settings else AnalysisSettings()
        )
    except ValidationError as exc:
        raise HTTPException(422, f"Invalid settings: {exc.errors()[0]['msg']}")

    job_id = str(uuid.uuid4())
    stored_name = f"{job_id}{ext}"
    dest = config.upload_dir / stored_name
    max_bytes = config.max_upload_mb * 1024 * 1024
    size = 0

    try:
        with dest.open("wb") as out:
            first = True
            while chunk := await file.read(CHUNK_SIZE):
                if first:
                    if not _looks_like_audio(chunk[:16], ext):
                        raise HTTPException(415, "File content doesn't look like valid audio.")
                    first = False
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(413, f"File too large (max {config.max_upload_mb} MB).")
                out.write(chunk)
        if size == 0:
            raise HTTPException(400, "The uploaded file is empty.")
    except Exception:
        dest.unlink(missing_ok=True)  # don't leave partial files behind
        raise

    job = Job(
        id=job_id,
        original_filename=file.filename or stored_name,
        stored_filename=stored_name,
        content_type=MEDIA_TYPES[ext],
        size_bytes=size,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(run_pipeline, job.id, settings)
    return job


@router.get("", response_model=list[JobOut])
def list_jobs(limit: int = 50, db: Session = Depends(get_db)):
    stmt = select(Job).order_by(Job.created_at.desc()).limit(min(limit, 200))
    return db.scalars(stmt).all()


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found.")
    return job


@router.get("/{job_id}/audio")
def get_audio(job_id: str, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    path = config.upload_dir / job.stored_filename if job else None
    if job is None or not path.exists():
        raise HTTPException(404, "Audio not found.")
    return FileResponse(path, media_type=job.content_type or "audio/mpeg")


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found.")
    (config.upload_dir / job.stored_filename).unlink(missing_ok=True)
    db.delete(job)
    db.commit()


# ---------------- results, re-analysis, speaker roles ----------------

def _get_job_or_404(db: Session, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found.")
    return job


@router.get("/{job_id}/result", response_model=JobResultOut)
def get_result(job_id: str, version: int | None = None, db: Session = Depends(get_db)):
    """Everything the results page needs. Defaults to the latest completed analysis."""
    job = _get_job_or_404(db, job_id)
    speakers = {s.label: s for s in job.speakers}
    utterances = []
    language = None
    if job.transcript:
        language = job.transcript.language_code
        signals = load_signals(job)
        # Flags use the sensitivity of the analysis being viewed, so the chips match its verdict.
        chosen_for_voice = None
        if version is not None:
            chosen_for_voice = next((a for a in job.analyses if a.version == version), None)
        else:
            done = [a for a in job.analyses if a.status == "completed"]
            chosen_for_voice = done[-1] if done else None
        sens = ((chosen_for_voice.settings_snapshot or {}).get("tone_sensitivity", "balanced")
                if chosen_for_voice else "balanced")
        voice_on = ((chosen_for_voice.settings_snapshot or {}).get("voice_mode", "off")
                    if chosen_for_voice else "off") != "off"
        utterances = [
            UtteranceOut(
                id=u.id, idx=u.idx, speaker_label=u.speaker_label,
                role=speakers[u.speaker_label].role if u.speaker_label in speakers else "unknown",
                start_ms=u.start_ms, end_ms=u.end_ms, text=u.text, confidence=u.confidence,
                voice=(UtteranceVoiceOut(**public_view(signals[u.id], sens))
                       if voice_on and u.id in signals and public_view(signals[u.id], sens) else None))
            for u in job.transcript.utterances
        ]

    analyses = list(job.analyses)
    if version is not None:
        chosen = next((a for a in analyses if a.version == version), None)
        if chosen is None:
            raise HTTPException(404, f"Analysis version {version} not found.")
    else:
        completed = [a for a in analyses if a.status == "completed"]
        chosen = completed[-1] if completed else None

    return JobResultOut(
        job=JobOut.model_validate(job),
        language_code=language,
        utterances=utterances,
        speakers=[SpeakerOut.model_validate(s) for s in job.speakers],
        analysis=AnalysisOut.model_validate(chosen) if chosen else None,
        versions=[VersionOut(version=a.version, status=a.status, tone=a.tone,
                             llm_model=a.llm_model, created_at=a.created_at) for a in analyses],
        voice=(VoiceStatusOut(status=job.voice.status, message=job.voice.message,
                              quality=job.voice.quality, coverage=job.voice.coverage)
               if job.voice else None),
    )


@router.post("/{job_id}/reanalyse", response_model=JobOut, status_code=202)
def reanalyse(job_id: str, settings: AnalysisSettings, background_tasks: BackgroundTasks,
              db: Session = Depends(get_db)):
    """Re-run only the Claude step with new settings. Never re-transcribes (no extra transcription cost)."""
    job = _get_job_or_404(db, job_id)
    if job.status in BUSY:
        raise HTTPException(409, "This call is still being processed. Wait for it to finish.")
    if job.transcript is None:
        raise HTTPException(409, "There is no transcript to analyse (transcription failed). Please upload the file again.")
    job.status = JobStatus.ANALYSING.value
    job.error_message = None
    job.failed_stage = None
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_reanalysis, job.id, settings)
    return job


@router.put("/{job_id}/speakers", response_model=list[SpeakerOut])
def assign_rep(job_id: str, body: RepAssignment, db: Session = Depends(get_db)):
    """Manual override ('swap roles'). Everyone else becomes the customer.
    The override is kept across re-analyses. Call /reanalyse afterwards to apply it."""
    job = _get_job_or_404(db, job_id)
    if job.status in BUSY:
        raise HTTPException(409, "This call is still being processed. Wait for it to finish.")
    if not job.speakers:
        raise HTTPException(409, "No speakers available yet (transcription has not completed).")
    labels = {s.label for s in job.speakers}
    if body.rep_label not in labels:
        raise HTTPException(422, f"Unknown speaker '{body.rep_label}'. Valid labels: {sorted(labels)}")
    for s in job.speakers:
        s.role = "rep" if s.label == body.rep_label else "customer"
        s.role_source = "user"
        s.role_confidence = 1.0
        s.role_reasoning = "Set manually by the user."
    db.commit()
    return [SpeakerOut.model_validate(s) for s in job.speakers]
