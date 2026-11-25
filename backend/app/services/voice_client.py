"""Behavioral Signals client. Isolated here so the rest of the app never touches the SDK.

Contract: fetch_voice() NEVER raises. A voice failure must not fail a job; the caller
falls back to words-only tone and shows the message as a warning.

I have not been able to see a live response while writing this, so parse_results() is
deliberately tolerant of naming variants (dict / object, camelCase / snake_case).
Run `python -m scripts.voice_probe <audio>` first to see the real rows.
"""
import logging
import tempfile
import wave
from dataclasses import dataclass, field
from pathlib import Path

from ..config import config
from .voice_features import PROB_TASKS, SCORE_TASKS, Segment

log = logging.getLogger(__name__)


@dataclass
class VoiceFetch:
    status: str                       # ok | failed | unavailable
    message: str | None = None
    provider_pid: str | None = None
    segments: list[Segment] = field(default_factory=list)
    quality: float | None = None
    raw_sample: list = field(default_factory=list)   # first rows, for debugging


def is_configured() -> bool:
    return bool(config.behavioralsignals_cid and config.behavioralsignals_api_key)


# ---------------- parsing ----------------

def _get(obj, *names, default=None):
    for n in names:
        if isinstance(obj, dict):
            if n in obj and obj[n] is not None:
                return obj[n]
        elif getattr(obj, n, None) is not None:
            return getattr(obj, n)
    return default


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _rows(prediction) -> dict[str, float]:
    out: dict[str, float] = {}
    for p in prediction or []:
        label = _get(p, "label")
        post = _num(_get(p, "posterior", "probability", "score"))
        if label is not None and post is not None:
            out[str(label).strip().lower()] = post
    return out


def parse_results(items) -> list[Segment]:
    """Group the provider's rows (one per task per utterance) into Segments."""
    groups: dict = {}
    order: list = []
    for it in items or []:
        st = _num(_get(it, "startTime", "start_time", "st", "start"))
        et = _num(_get(it, "endTime", "end_time", "et", "end"))
        if st is None or et is None:
            continue
        key = _get(it, "id")
        key = ("id", str(key)) if key is not None else ("span", round(st, 2), round(et, 2))
        if key not in groups:
            groups[key] = Segment(start=st, end=et)
            order.append(key)
        seg = groups[key]
        seg.start, seg.end = min(seg.start, st), max(seg.end, et)

        task = str(_get(it, "task", default="")).strip().lower()
        if task == "diarization":
            sp = _get(it, "finalLabel", "final_label", "label")
            if sp is not None:
                seg.speaker = str(sp)
        elif task in PROB_TASKS:
            probs = _rows(_get(it, "prediction"))
            if not probs:
                final = _get(it, "finalLabel", "final_label")
                if final is not None:
                    probs = {str(final).strip().lower(): 1.0}
            if probs:
                seg.probs[task] = probs
        elif task in SCORE_TASKS:
            val = _num(_get(it, "score", "value", "finalLabel", "final_label"))
            if val is not None:
                seg.scores[SCORE_TASKS[task]] = val
    segs = [groups[k] for k in order]
    _inherit_speakers(segs)
    return segs


def _inherit_speakers(segs: list[Segment]) -> None:
    """Continuous (time-series) rows carry no diarization; give each the speaker it overlaps most."""
    known = [s for s in segs if s.speaker is not None]
    for s in segs:
        if s.speaker is None and known:
            best = max(known, key=lambda k: max(0.0, min(k.end, s.end) - max(k.start, s.start)))
            if min(best.end, s.end) - max(best.start, s.start) > 0:
                s.speaker = best.speaker


def mean_quality(segs: list[Segment]) -> float | None:
    vals = [s.scores["quality"] for s in segs if "quality" in s.scores]
    if not vals:
        return None
    q = sum(vals) / len(vals)
    return q / 100 if q > 1.5 else q   # tolerate a 0-100 scale


# ---------------- audio prep ----------------

def convert_to_wav(src: Path, dst: Path, sample_rate: int = 16000) -> None:
    import av
    with av.open(str(src)) as container:
        stream = next(s for s in container.streams if s.type == "audio")
        resampler = av.AudioResampler(format="s16", layout="mono", rate=sample_rate)
        with wave.open(str(dst), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sample_rate)

            def write(frames):
                for f in frames:
                    w.writeframes(bytes(f.planes[0])[: f.samples * 2])   # trim padding
            for frame in container.decode(stream):
                write(resampler.resample(frame))
            write(resampler.resample(None))


def prepare_audio(path: Path, workdir: Path) -> Path:
    mode = (config.voice_convert or "auto").lower()
    if mode == "never" or (mode == "auto" and path.suffix.lower() in (".wav", ".mp3")):
        return path
    out = workdir / (path.stem + ".wav")
    try:
        convert_to_wav(path, out)
        return out
    except Exception as exc:   # conversion is an optimisation; the original may still be accepted
        log.warning("Audio conversion failed (%s); sending the original file.", exc)
        return path


# ---------------- API call ----------------

def _friendly(exc: Exception) -> str:
    code = getattr(exc, "status_code", None)
    if code in (401, 403):
        return "Voice analysis was rejected: check BEHAVIORALSIGNALS_CID and BEHAVIORALSIGNALS_API_KEY."
    if code == 402:
        return "Voice analysis is out of Behavioral Signals credits."
    if isinstance(exc, TimeoutError):
        return "Voice analysis timed out. Tone was judged from the words only."
    return f"Voice analysis failed ({type(exc).__name__}: {str(exc)[:200]}). Tone was judged from the words only."


def _extract_items(result) -> list:
    if result is None:
        return []
    if isinstance(result, (list, tuple)):
        return list(result)
    inner = _get(result, "results", "data", "items")
    return list(inner) if isinstance(inner, (list, tuple)) else []


def fetch_voice(path: Path) -> VoiceFetch:
    if not is_configured():
        return VoiceFetch("unavailable", "Voice analysis is not configured (no Behavioral Signals keys), so tone was judged from the words only.")
    try:
        from behavioralsignals import Client
    except ImportError:
        return VoiceFetch("unavailable", "The 'behavioralsignals' package is not installed, so tone was judged from the words only.")
    try:
        with tempfile.TemporaryDirectory() as tmp:
            audio = prepare_audio(Path(path), Path(tmp))
            client = Client(config.behavioralsignals_cid, config.behavioralsignals_api_key)
            proc = client.behavioral.upload_audio(file_path=str(audio))
            pid = _get(proc, "pid", "id")
            result = client.behavioral.wait_for_result(
                pid=pid, timeout=config.voice_timeout_s, continuous=["valence", "arousal"])
        items = _extract_items(result)
        segs = [s for s in parse_results(items) if s.has_signals or s.speaker is not None]
        if not any(s.has_signals for s in segs):
            return VoiceFetch("failed", "Voice analysis returned no usable signals. Tone was judged from the words only.",
                              provider_pid=str(pid) if pid is not None else None, raw_sample=items[:6])
        return VoiceFetch("ok", None, str(pid) if pid is not None else None, segs, mean_quality(segs), items[:6])
    except Exception as exc:
        log.warning("Behavioral Signals call failed: %s", exc)
        return VoiceFetch("failed", _friendly(exc))
