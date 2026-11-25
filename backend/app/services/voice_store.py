"""Glue between the voice provider result and our DB. Fetch once per job, reuse on re-analysis."""
import logging

from sqlalchemy import delete

from ..config import config
from ..models import Job, UtteranceVoice, VoiceAnalysis
from .voice_client import VoiceFetch, fetch_voice, is_configured
from .voice_features import add_baselines, aggregate_utterance, map_speakers

log = logging.getLogger(__name__)


def build_signals(utterances, fetch: VoiceFetch) -> tuple[dict, dict]:
    """-> (signals by utterance db id, provider->our speaker map). Pure given its inputs."""
    ours = [(u.speaker_label, u.start_ms / 1000, u.end_ms / 1000) for u in utterances]
    speaker_map = map_speakers(ours, fetch.segments)
    signals: dict[int, dict] = {}
    labels: dict[int, str] = {}
    for u in utterances:
        sig = aggregate_utterance(u.start_ms / 1000, u.end_ms / 1000, u.speaker_label,
                                  fetch.segments, speaker_map, config.voice_min_coverage)
        if sig:
            signals[u.id] = sig
            labels[u.id] = u.speaker_label
    add_baselines(signals, labels)
    return signals, speaker_map


def store_voice(db, job: Job, fetch: VoiceFetch) -> None:
    """Replace any previous voice result for this job with `fetch`."""
    old = db.query(VoiceAnalysis).filter_by(job_id=job.id).one_or_none()
    if old is not None:
        db.delete(old)
    if job.transcript is not None:
        ids = [u.id for u in job.transcript.utterances]
        if ids:
            db.execute(delete(UtteranceVoice).where(UtteranceVoice.utterance_id.in_(ids)))
    db.flush()

    signals, speaker_map, coverage, message = {}, None, None, fetch.message
    if fetch.status == "ok" and job.transcript is not None:
        utts = list(job.transcript.utterances)
        signals, speaker_map = build_signals(utts, fetch)
        coverage = round(len(signals) / len(utts), 3) if utts else 0.0
        for uid, sig in signals.items():
            db.add(UtteranceVoice(utterance_id=uid, signals=sig))
        if not signals:
            message = "Voice analysis ran but its timing did not line up with the transcript, so tone was judged from the words only."
    db.add(VoiceAnalysis(
        job_id=job.id, provider_process_id=fetch.provider_pid, status=fetch.status,
        message=message, quality=fetch.quality, coverage=coverage, speaker_map=speaker_map))
    db.commit()
    db.refresh(job)


def load_signals(job: Job) -> dict[int, dict]:
    if job.transcript is None:
        return {}
    return {u.id: u.voice.signals for u in job.transcript.utterances if u.voice is not None}


def ensure_voice(db, job: Job, wanted: bool) -> None:
    """Fetch voice if it is wanted, configured, and not already stored successfully.
    Covers calls uploaded before voice existed and keys added later. Never raises."""
    if not wanted or not is_configured():
        return
    if job.voice is not None and job.voice.status == "ok":
        return
    from ..config import config as cfg
    path = cfg.upload_dir / job.stored_filename
    if not path.exists():
        return
    try:
        store_voice(db, job, fetch_voice(path))
    except Exception:
        log.exception("Storing voice analysis failed for job %s", job.id)
        db.rollback()
