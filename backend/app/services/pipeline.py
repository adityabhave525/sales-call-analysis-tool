"""Background pipeline. STUB for now: it walks through the stages and then
marks the job failed with a clear message. Next step: implement each TODO."""
import logging
import time

from ..database import SessionLocal
from ..models import Job, JobStatus
from ..schemas import AnalysisSettings

log = logging.getLogger(__name__)


def run_pipeline(job_id: str, settings: AnalysisSettings) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if job is None:
            return

        job.status = JobStatus.TRANSCRIBING.value
        db.commit()
        # TODO 1: upload audio to AssemblyAI, poll, save Transcript + Utterances
        time.sleep(2)

        job.status = JobStatus.ANALYSING.value
        db.commit()
        # TODO 2: infer rep/customer roles -> Speaker rows
        # TODO 3: call Claude with transcript + settings -> Analysis, ToneEvidence, ActionItems
        # TODO 4: verify every quote against Utterance text (rapidfuzz) before saving
        time.sleep(2)

        job.status = JobStatus.FAILED.value
        job.failed_stage = "analysing"
        job.error_message = "Pipeline not implemented yet (starter stub)."
        db.commit()
    except Exception as exc:  # never let a background task die silently
        log.exception("Pipeline crashed for job %s", job_id)
        db.rollback()
        job = db.get(Job, job_id)
        if job:
            job.status = JobStatus.FAILED.value
            job.error_message = f"Unexpected error: {exc}"
            db.commit()
    finally:
        db.close()
