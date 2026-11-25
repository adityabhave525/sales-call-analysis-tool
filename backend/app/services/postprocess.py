"""Turns raw LLM output into trustworthy results.

Pure Python (no DB, no pydantic) so every rule below is unit-tested.
The LLM *proposes*; this module *decides*:
  - tone is RED only if the LLM says negative AND confidence >= the user's
    threshold AND at least one verified quote from the REP supports it
  - unverifiable quotes/items are dropped (and counted in warnings)
  - owners/deadlines the transcript doesn't support are nulled, never invented
"""
from dataclasses import dataclass, field

from .verification import normalize, verify_quote

LOW_CONFIDENCE = 0.6
LOW_AUDIO_QUALITY = 0.4
MAX_EVIDENCE = 8
MAX_ACTION_ITEMS = 30


@dataclass
class UttView:
    idx: int
    speaker: str
    role: str          # rep | customer | unknown
    start_ms: int
    text: str
    db_id: int | None = None
    voice: dict | None = None   # {'flags': [...], 'cues': [...]} from voice_features.describe


@dataclass
class Outcome:
    tone: str
    tone_confidence: float | None
    needs_review: bool
    explanation: str
    summary: str
    evidence: list[dict] = field(default_factory=list)
    action_items: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def clamp01(x, default: float = 0.5) -> float:
    try:
        return max(0.0, min(1.0, float(x)))
    except (TypeError, ValueError):
        return default


def _display_quote(quote: str, utt: UttView, method: str) -> str:
    # near-matches show the real transcript line so we never display words nobody said
    return utt.text if method == "fuzzy" else quote.strip()


def _int_or_none(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def normalize_roles(raw_roles: list[dict], labels: list[str]) -> dict[str, tuple[str, float | None, str]]:
    """label -> (role, confidence, reasoning). Enforces at most one rep and
    resolves the common two-speaker cases sensibly."""
    out: dict[str, tuple[str, float | None, str]] = {l: ("unknown", None, "") for l in labels}
    by_label = {l.upper(): l for l in labels}
    for r in raw_roles or []:
        key = str(r.get("speaker", "")).upper().replace("SPEAKER", "").strip()
        label = by_label.get(key)
        role = r.get("role")
        if label and role in ("rep", "customer", "unknown"):
            out[label] = (role, clamp01(r.get("confidence")), str(r.get("reasoning", ""))[:500])

    reps = [l for l, v in out.items() if v[0] == "rep"]
    if len(reps) > 1:  # keep the most confident rep, demote the rest
        keep = max(reps, key=lambda l: out[l][1] or 0)
        for l in reps:
            if l != keep:
                out[l] = ("customer", (out[l][1] or 0.5) * 0.5, "Demoted: only one rep allowed. " + out[l][2])

    if len(labels) == 2:
        a, b = labels
        (ra, ca, _), (rb, cb, _) = out[a], out[b]
        if ra == rb and ra != "unknown":  # both same role -> contradiction
            out[a] = ("unknown", 0.3, "Both speakers were given the same role.")
            out[b] = ("unknown", 0.3, "Both speakers were given the same role.")
        elif ra == "unknown" and rb in ("rep", "customer"):
            out[a] = ("customer" if rb == "rep" else "rep", (cb or 0.5) * 0.9, "Inferred as the opposite of the other speaker.")
        elif rb == "unknown" and ra in ("rep", "customer"):
            out[b] = ("customer" if ra == "rep" else "rep", (ca or 0.5) * 0.9, "Inferred as the opposite of the other speaker.")
    return out


def postprocess(
    raw: dict,
    utts: list[UttView],
    *,
    red_threshold: float,
    allowed_types: list[str],
    include_customer: bool,
    rep_role_confidence: float | None,
    language_code: str | None = None,
    voice_mode: str = "off",
    voice_available: bool = False,
    voice_note: str | None = None,
    voice_quality: float | None = None,
) -> Outcome:
    by_idx = {u.idx: u for u in utts}
    texts = {u.idx: u.text for u in utts}
    warnings: list[str] = []
    rep_identified = any(u.role == "rep" for u in utts)
    needs_review = False

    if language_code and not language_code.lower().startswith("en"):
        warnings.append(f"Detected language '{language_code}'. The analysis is tuned for English and may be less reliable.")
        needs_review = True

    voice_on = voice_mode != "off"
    if voice_on and not voice_available and voice_note:
        warnings.append(voice_note)

    # ---------- tone evidence ----------
    evidence: list[dict] = []
    dropped_unverified = dropped_not_rep = dropped_voice = downgraded_voice = 0
    for ev in raw.get("tone_evidence") or []:
        m = verify_quote(ev.get("quote", ""), texts, _int_or_none(ev.get("utterance_index")))
        if not m.verified:
            dropped_unverified += 1
            continue
        utt = by_idx[m.utterance_idx]
        if utt.role != "rep":
            dropped_not_rep += 1   # tone is judged on the rep only
            continue
        # Voice claims must be backed by a measured flag on that very line.
        measured = bool(voice_on and voice_available and utt.voice and utt.voice.get("flags"))
        basis = ev.get("basis") if ev.get("basis") in ("words", "voice", "words_and_voice") else "words"
        if basis != "words" and not measured:
            if basis == "voice":
                dropped_voice += 1      # nothing but an unmeasured voice claim: remove it
                continue
            basis = "words"
            downgraded_voice += 1
        evidence.append({
            "basis": basis,
            "voice_cues": list(utt.voice["cues"]) if measured else [],
            "utterance_idx": utt.idx, "utterance_db_id": utt.db_id,
            "quote": _display_quote(ev.get("quote", ""), utt, m.method),
            "start_ms": utt.start_ms,
            "criterion": (str(ev.get("criterion") or "")[:50] or None),
            "severity": ev.get("severity") if ev.get("severity") in ("low", "medium", "high") else "medium",
            "explanation": (str(ev.get("explanation") or "")[:500] or None),
            "method": m.method,
        })
    evidence = evidence[:MAX_EVIDENCE]
    if dropped_unverified:
        warnings.append(f"{dropped_unverified} tone quote(s) could not be found in the transcript and were removed.")
    if dropped_not_rep:
        warnings.append(f"{dropped_not_rep} tone quote(s) were from the customer, not the rep, and were ignored.")
    if voice_on and dropped_voice:
        warnings.append(f"{dropped_voice} voice-based claim(s) had no measured voice signal behind them and were removed.")
    if voice_on and downgraded_voice:
        warnings.append(f"{downgraded_voice} evidence item(s) claimed a vocal quality that was not measured; they now rest on the words only.")

    model_negative = bool(raw.get("rep_tone_negative"))
    conf = clamp01(raw.get("tone_confidence"))
    explanation = str(raw.get("tone_explanation") or "").strip()

    if not rep_identified:
        tone, tone_conf = "GREEN", None
        needs_review = True
        evidence = []
        explanation = ("Tone could not be assessed because the sales representative could not be identified. "
                       "Assign the rep in the speaker settings, then re-analyse.")
        warnings.append("No speaker was identified as the sales rep.")
    else:
        tone_conf = conf
        # Voice-only evidence counts toward RED only in 'strong' mode.
        counting = [e for e in evidence if e["basis"] != "voice" or voice_mode == "strong"]
        if model_negative and counting and conf >= red_threshold:
            tone = "RED"
        else:
            tone = "GREEN"
            if model_negative and evidence and not counting:
                needs_review = True
                warnings.append("Only the rep's voice suggested a negative tone, not the words. Set voice analysis to "
                                "'Strong' if voice alone should be enough for RED. Review this call.")
            elif model_negative and evidence:
                needs_review = True
                warnings.append(
                    f"Possible negative tone, but confidence ({conf:.0%}) is below your RED threshold ({red_threshold:.0%}).")
            elif model_negative:
                needs_review = True
                warnings.append("The model suspected negative tone but no quote from the rep could be verified, so it was not flagged RED.")
        if conf < LOW_CONFIDENCE:
            needs_review = True
        if (voice_on and voice_available and voice_quality is not None and voice_quality < LOW_AUDIO_QUALITY
                and any(e["basis"] != "words" for e in evidence)):
            needs_review = True
            warnings.append("The recording quality is low, so voice-based findings are less reliable.")
        if rep_role_confidence is not None and rep_role_confidence < LOW_CONFIDENCE:
            needs_review = True
            warnings.append("Rep/customer roles were inferred with low confidence. Check them and swap if needed.")

    # ---------- action items ----------
    items: list[dict] = []
    dropped_items = nulled_deadlines = 0
    seen: set[tuple[int, str]] = set()
    for it in raw.get("action_items") or []:
        if it.get("item_type") not in allowed_types:
            continue  # type disabled in settings; not an error
        m = verify_quote(it.get("quote", ""), texts, _int_or_none(it.get("utterance_index")))
        desc = str(it.get("description") or "").strip()
        if not m.verified or not desc:
            dropped_items += 1
            continue
        utt = by_idx[m.utterance_idx]

        owner = it.get("owner_role") if it.get("owner_role") in ("rep", "customer") else None
        if owner == "customer" and not include_customer:
            continue

        deadline = str(it.get("deadline_text") or "").strip() or None
        if deadline:
            window = " ".join(normalize(texts[i]) for i in range(utt.idx - 2, utt.idx + 3) if i in texts)
            if f" {normalize(deadline)} " not in f" {window} ":
                deadline = None   # never invent deadlines
                nulled_deadlines += 1

        key = (utt.idx, normalize(desc))
        if key in seen:
            continue
        seen.add(key)
        items.append({
            "description": desc[:500], "item_type": it.get("item_type"),
            "owner_role": owner, "deadline_text": deadline,
            "quote": _display_quote(it.get("quote", ""), utt, m.method),
            "utterance_idx": utt.idx, "utterance_db_id": utt.db_id,
            "start_ms": utt.start_ms, "confidence": clamp01(it.get("confidence")),
        })
    items = sorted(items, key=lambda x: x["start_ms"])[:MAX_ACTION_ITEMS]
    if dropped_items:
        warnings.append(f"{dropped_items} action item(s) had no verifiable supporting quote and were removed.")
    if nulled_deadlines:
        warnings.append(f"{nulled_deadlines} deadline(s) were not stated in the transcript and were set to 'Not specified'.")

    return Outcome(
        tone=tone, tone_confidence=tone_conf, needs_review=needs_review,
        explanation=explanation, summary=str(raw.get("call_summary") or "").strip(),
        evidence=evidence, action_items=items, warnings=warnings,
    )
