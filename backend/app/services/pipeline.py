"""Background pipeline: transcribe -> (roles + analysis). Runs in a worker thread."""
import logging
from concurrent.futures import ThreadPoolExecutor

from ..config import config
from ..database import SessionLocal
from ..models import Job, JobStatus, Speaker, Transcript, Utterance
from ..schemas import AnalysisSettings
from .analysis import run_analysis
from .transcription import TranscriptData, TranscriptionError, transcribe_file
from .voice_client import fetch_voice, is_configured
from .voice_store import store_voice

log = logging.getLogger(__name__)


def _fail_job(job_id: str, stage: str, message: str) -> None:
    with SessionLocal() as db:
        job = db.get(Job, job_id)
        if job:
            job.status = JobStatus.FAILED.value
            job.failed_stage = stage
            job.error_message = message
            db.commit()


def _save_transcript(db, job: Job, data: TranscriptData) -> None:
    t = Transcript(
        job_id=job.id, provider="assemblyai", provider_transcript_id=data.provider_id,
        language_code=data.language_code, full_text=data.text, confidence=data.confidence,
    )
    t.utterances = [
        Utterance(idx=i, speaker_label=u.speaker, start_ms=u.start_ms, end_ms=u.end_ms,
                  text=u.text, confidence=u.confidence)
        for i, u in enumerate(data.utterances)
    ]
    db.add(t)
    # create speaker rows now so the user can assign roles even if the LLM step fails
    for label in sorted({u.speaker for u in data.utterances}):
        db.add(Speaker(job_id=job.id, label=label, role="unknown", role_source="auto"))
    job.duration_ms = data.duration_ms
    db.commit()


def run_pipeline(job_id: str, settings: AnalysisSettings) -> None:
    try:
        with SessionLocal() as db:
            job = db.get(Job, job_id)
            if job is None:
                return
            job.status = JobStatus.TRANSCRIBING.value
            db.commit()
            path = config.upload_dir / job.stored_filename

        # Transcription and voice analysis are independent, so run them side by side.
        # fetch_voice never raises; a voice failure only means "judge tone from words".
        want_voice = settings.voice_mode != "off" and is_configured()
        pool = ThreadPoolExecutor(max_workers=1)
        try:
            voice_future = pool.submit(fetch_voice, path) if want_voice else None
            data = transcribe_file(path)  # slow; no DB transaction held open
            voice = voice_future.result() if voice_future else None
        finally:
            pool.shutdown(wait=False)   # if transcription failed, don't make the user wait for voice

        with SessionLocal() as db:
            job = db.get(Job, job_id)
            if job is None:  # deleted while processing
                return
            _save_transcript(db, job, data)
            if voice is not None:
                try:
                    store_voice(db, job, voice)
                except Exception:
                    log.exception("Could not store voice analysis for job %s", job_id)
                    db.rollback()

        run_analysis(job_id, settings)
    except TranscriptionError as exc:
        _fail_job(job_id, "transcribing", str(exc))
    except Exception as exc:
        log.exception("Pipeline crashed for job %s", job_id)
        _fail_job(job_id, "processing", f"Unexpected error: {exc}")


def run_reanalysis(job_id: str, settings: AnalysisSettings) -> None:
    try:
        run_analysis(job_id, settings)
    except Exception as exc:  # run_analysis handles its own errors; this is a last resort
        log.exception("Re-analysis crashed for job %s", job_id)
        _fail_job(job_id, "analysing", f"Unexpected error: {exc}")
