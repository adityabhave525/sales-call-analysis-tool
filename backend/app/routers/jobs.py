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
from ..models import Job
from ..schemas import AnalysisSettings, JobOut
from ..services.pipeline import run_pipeline

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

ALLOWED_EXTENSIONS = {".m4a", ".mp3"}
MEDIA_TYPES = {".m4a": "audio/mp4", ".mp3": "audio/mpeg"}
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
