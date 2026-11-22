"""AssemblyAI transcription + speaker diarization (blocking; runs in a worker thread)."""
import logging
from dataclasses import dataclass, field
from pathlib import Path

from ..config import config

log = logging.getLogger(__name__)


class TranscriptionError(Exception):
    """Message is safe to show to the end user."""


@dataclass
class UtteranceData:
    speaker: str
    start_ms: int
    end_ms: int
    text: str
    confidence: float | None


@dataclass
class TranscriptData:
    provider_id: str | None
    language_code: str | None
    text: str
    confidence: float | None
    duration_ms: int | None
    utterances: list[UtteranceData] = field(default_factory=list)


def transcribe_file(path: Path) -> TranscriptData:
    if not config.assemblyai_api_key:
        raise TranscriptionError("The AssemblyAI API key is not configured. Add ASSEMBLYAI_API_KEY to backend/.env and restart the server.")
    if not path.exists():
        raise TranscriptionError("The uploaded audio file is missing on the server. Please upload it again.")

    import assemblyai as aai

    aai.settings.api_key = config.assemblyai_api_key
    cfg = aai.TranscriptionConfig(
        speech_models=config.speech_model_list,
        speaker_labels=True,
        language_detection=True,
    )
    try:
        t = aai.Transcriber(config=cfg).transcribe(str(path))
    except Exception as exc:  # network errors, SDK errors, bad params
        log.exception("AssemblyAI call failed")
        raise TranscriptionError(f"Could not get a transcript from AssemblyAI: {exc}") from exc

    if t.status == aai.TranscriptStatus.error:
        raise TranscriptionError(f"AssemblyAI could not transcribe this audio: {t.error}")

    raw = getattr(t, "json_response", None) or {}
    utterances = [
        UtteranceData(
            speaker=str(u.speaker), start_ms=int(u.start), end_ms=int(u.end),
            text=(u.text or "").strip(), confidence=getattr(u, "confidence", None),
        )
        for u in (t.utterances or []) if (u.text or "").strip()
    ]
    if not utterances and (t.text or "").strip():
        # diarization returned nothing but there is speech: treat it as one speaker
        utterances = [UtteranceData("A", 0, 0, t.text.strip(), getattr(t, "confidence", None))]
    if not utterances:
        raise TranscriptionError("No speech was detected in this recording.")

    duration = getattr(t, "audio_duration", None) or raw.get("audio_duration")
    return TranscriptData(
        provider_id=getattr(t, "id", None),
        language_code=raw.get("language_code"),
        text=t.text or "",
        confidence=getattr(t, "confidence", None),
        duration_ms=int(float(duration) * 1000) if duration else None,
        utterances=utterances,
    )
