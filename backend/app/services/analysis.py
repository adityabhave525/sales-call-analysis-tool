"""Stage 2: speaker roles + Claude analysis + verification + persistence.
Used by the first run and by re-analysis (which never re-transcribes)."""
import logging
from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy import func, select

from ..config import config
from ..database import SessionLocal
from ..models import ActionItem, Analysis, Job, JobStatus, Speaker, ToneEvidence
from ..schemas import AnalysisSettings
from .llm import LLMError, call_tool
from .llm_schemas import AnalysisToolOutput, RolesToolOutput
from .postprocess import UttView, normalize_roles, postprocess
from .prompts import (ROLES_SYSTEM, build_roles_message, build_system_prompt,
                      build_user_message)
from .schema_utils import inline_refs
from .voice_features import describe
from .voice_store import ensure_voice, load_signals

log = logging.getLogger(__name__)

ROLES_HEAD, ROLES_TAIL, ROLES_LINE_CHARS = 20, 6, 280


class AnalysisError(Exception):
    """Message is safe to show to the end user."""


def _now():
    return datetime.now(timezone.utc)


def _validate(model_cls, data: dict) -> dict:
    try:
        return model_cls.model_validate(data).model_dump()
    except ValidationError as exc:
        log.warning("LLM output failed validation: %s", exc)
        raise LLMError("Claude returned a result in an unexpected format. Please re-run the analysis.") from exc


def _ensure_roles(db, job: Job, utterances, settings: AnalysisSettings) -> tuple[dict[str, Speaker], int, int]:
    """Infer rep/customer once; keep it (and any manual override) across re-analyses."""
    labels = sorted({u.speaker_label for u in utterances})
    existing = {s.label: s for s in job.speakers}
    if any(s.role in ("rep", "customer") for s in existing.values()):
        return existing, 0, 0

    tokens_in = tokens_out = 0
    if len(labels) < 2:
        roles = {l: ("unknown", None, "Only one speaker was detected in this recording.") for l in labels}
    else:
        if len(utterances) > ROLES_HEAD + ROLES_TAIL:
            sample = utterances[:ROLES_HEAD] + utterances[-ROLES_TAIL:]
        else:
            sample = list(utterances)
        lines = [f"[{u.idx}] SPEAKER {u.speaker_label}: {u.text[:ROLES_LINE_CHARS]}" for u in sample]
        res = call_tool(
            model=settings.llm_model, system=ROLES_SYSTEM,
            user=build_roles_message(lines, labels),
            tool_name="submit_roles",
            tool_description="Submit the role of each speaker.",
            schema=inline_refs(RolesToolOutput.model_json_schema()),
            max_tokens=4096,
        )
        tokens_in, tokens_out = res.input_tokens, res.output_tokens
        parsed = _validate(RolesToolOutput, res.data)
        roles = normalize_roles(parsed["roles"], labels)

    for label, (role, conf, why) in roles.items():
        sp = existing.get(label) or Speaker(job_id=job.id, label=label)
        sp.role, sp.role_confidence, sp.role_reasoning, sp.role_source = role, conf, why, "auto"
        db.add(sp)
    db.commit()
    db.refresh(job)
    return {s.label: s for s in job.speakers}, tokens_in, tokens_out


def _fail(db, job: Job, analysis: Analysis, message: str) -> None:
    analysis.status = "failed"
    analysis.error_message = message
    analysis.completed_at = _now()
    had_good = (db.scalar(select(func.count()).select_from(Analysis).where(
        Analysis.job_id == job.id, Analysis.status == "completed")) or 0) > 0
    # a failed re-analysis must not hide an earlier good result
    job.status = JobStatus.COMPLETED.value if had_good else JobStatus.FAILED.value
    job.failed_stage = None if had_good else "analysing"
    job.error_message = message
    db.commit()


def run_analysis(job_id: str, settings: AnalysisSettings) -> None:
    with SessionLocal() as db:
        job = db.get(Job, job_id)
        if job is None or job.transcript is None:
            return
        job.status = JobStatus.ANALYSING.value
        job.error_message = None
        job.failed_stage = None

        version = (db.scalar(select(func.max(Analysis.version)).where(Analysis.job_id == job_id)) or 0) + 1
        analysis = Analysis(job_id=job_id, version=version, status="running",
                            llm_model=settings.llm_model, settings_snapshot=settings.model_dump(),
                            warnings=[])
        db.add(analysis)
        db.commit()

        try:
            utterances = list(job.transcript.utterances)
            if not utterances:
                raise AnalysisError("The transcript is empty, so there is nothing to analyse.")
            if sum(len(u.text) for u in utterances) > config.max_transcript_chars:
                raise AnalysisError("This call is too long to analyse in one pass. Try a shorter recording.")

            speakers, roles_in, roles_out = _ensure_roles(db, job, utterances, settings)
            # Remember which roles this run used, so the UI can tell when a later
            # role swap means the result is out of date. Lives inside the existing
            # JSON column, so no migration is needed.
            analysis.settings_snapshot = {
                **settings.model_dump(),
                "roles_used": {s.label: s.role for s in speakers.values()},
            }
            # Voice: fetched once per job (kept in the DB); a failure only means "words only".
            voice_on = settings.voice_mode != "off"
            ensure_voice(db, job, voice_on)
            db.refresh(job)
            vrow = job.voice
            voice_available = bool(voice_on and vrow is not None and vrow.status == "ok" and (vrow.coverage or 0) > 0)
            voice_note = None if voice_available else (
                vrow.message if vrow is not None else "Voice analysis has not been run for this call.")
            signals = load_signals(job) if voice_available else {}
            views = [
                UttView(idx=u.idx, speaker=u.speaker_label,
                        role=speakers[u.speaker_label].role if u.speaker_label in speakers else "unknown",
                        start_ms=u.start_ms, text=u.text, db_id=u.id,
                        voice=describe(signals.get(u.id), settings.tone_sensitivity) if u.id in signals else None)
                for u in utterances
            ]
            rep = next((s for s in speakers.values() if s.role == "rep"), None)
            rep_conf = None if rep is None else (1.0 if rep.role_source == "user" else rep.role_confidence)

            res = call_tool(
                model=settings.llm_model,
                system=build_system_prompt(settings, voice_available),
                user=build_user_message(views, voice_available),
                tool_name="submit_analysis",
                tool_description="Submit the tone assessment, evidence and action items for this call.",
                schema=inline_refs(AnalysisToolOutput.model_json_schema()),
            )
            raw = _validate(AnalysisToolOutput, res.data)

            outcome = postprocess(
                raw, views,
                red_threshold=settings.red_confidence_threshold,
                allowed_types=list(settings.action_item_types),
                include_customer=settings.include_customer_actions,
                rep_role_confidence=rep_conf,
                language_code=job.transcript.language_code,
                voice_mode=settings.voice_mode,
                voice_available=voice_available,
                voice_note=voice_note,
                voice_quality=vrow.quality if voice_available else None,
            )

            analysis.tone = outcome.tone
            analysis.tone_confidence = outcome.tone_confidence
            analysis.needs_review = outcome.needs_review
            analysis.tone_explanation = outcome.explanation
            analysis.call_summary = outcome.summary
            analysis.warnings = outcome.warnings
            analysis.input_tokens = roles_in + res.input_tokens
            analysis.output_tokens = roles_out + res.output_tokens
            for ev in outcome.evidence:
                db.add(ToneEvidence(
                    analysis_id=analysis.id, utterance_id=ev["utterance_db_id"], quote=ev["quote"],
                    start_ms=ev["start_ms"], criterion=ev["criterion"], severity=ev["severity"],
                    explanation=ev["explanation"], verified=True,
                    basis=ev["basis"], voice_cues=ev["voice_cues"]))
            for it in outcome.action_items:
                db.add(ActionItem(
                    analysis_id=analysis.id, utterance_id=it["utterance_db_id"], description=it["description"],
                    item_type=it["item_type"], owner_role=it["owner_role"], deadline_text=it["deadline_text"],
                    quote=it["quote"], start_ms=it["start_ms"], confidence=it["confidence"], verified=True))
            analysis.status = "completed"
            analysis.completed_at = _now()
            job.status = JobStatus.COMPLETED.value
            db.commit()
        except (LLMError, AnalysisError) as exc:
            db.rollback()
            _fail(db, job, analysis, str(exc))
        except Exception as exc:
            log.exception("Analysis crashed for job %s", job_id)
            db.rollback()
            _fail(db, job, analysis, f"Unexpected error during analysis: {exc}")
