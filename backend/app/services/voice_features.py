"""Turns provider voice signals into per-utterance voice features.

Pure Python (no network, no DB) so every rule is unit-tested.

Flow:  provider segments (own diarization, own timestamps)
         -> map_speakers      provider speaker id -> OUR speaker label (by time overlap)
         -> aggregate_utterance   weighted average of the signals over one of OUR utterances
         -> add_baselines     z-scores against the same speaker's own median
         -> describe          flags/cues using the user's sensitivity (computed at READ time,
                              so changing sensitivity never needs a new API call)
Raw probabilities are stored; thresholds are provisional and meant to be calibrated on real audio.
"""
from dataclasses import dataclass, field
from statistics import median

PROB_TASKS = ("emotion", "strength", "positivity", "speaking_rate", "shouting", "hesitation", "engagement")
# provider task name -> key stored in `scores`
SCORE_TASKS = {
    "intensity": "intensity",
    "monotony": "monotony",
    "continuous_valence": "valence",
    "continuous_arousal": "arousal",
    "valence": "valence",
    "arousal": "arousal",
    "signal_quality.overall": "quality",
    "signal_quality": "quality",
}


@dataclass
class Segment:
    start: float                      # seconds
    end: float
    speaker: str | None = None        # provider's speaker id
    probs: dict[str, dict[str, float]] = field(default_factory=dict)   # task -> label -> probability
    scores: dict[str, float] = field(default_factory=dict)             # name -> value

    @property
    def has_signals(self) -> bool:
        return bool(self.probs or self.scores)


def overlap(a0: float, a1: float, b0: float, b1: float) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def map_speakers(ours: list[tuple[str, float, float]], segments: list[Segment]) -> dict[str, str]:
    """provider speaker -> our label. Greedy one-to-one by total overlap; any provider
    speaker left over (more provider speakers than ours) goes to its best-overlapping label."""
    labels = sorted({l for l, _, _ in ours})
    provider = sorted({s.speaker for s in segments if s.speaker is not None})
    if not labels or not provider:
        return {}
    table: dict[tuple[str, str], float] = {}
    for p in provider:
        for l in labels:
            table[(p, l)] = sum(
                overlap(s.start, s.end, u0, u1)
                for s in segments if s.speaker == p for lab, u0, u1 in ours if lab == l)
    mapping: dict[str, str] = {}
    used_p: set[str] = set()
    used_l: set[str] = set()
    for (p, l), v in sorted(table.items(), key=lambda kv: -kv[1]):
        if v <= 0 or p in used_p or l in used_l:
            continue
        mapping[p] = l
        used_p.add(p)
        used_l.add(l)
    for p in provider:
        if p not in mapping:
            best = max(labels, key=lambda l: table[(p, l)])
            if table[(p, best)] > 0:
                mapping[p] = best
    return mapping


def _wavg(pairs: list[tuple[float, float]]) -> float | None:
    tot = sum(w for _, w in pairs)
    return None if tot <= 0 else sum(v * w for v, w in pairs) / tot


def aggregate_utterance(start_s: float, end_s: float, label: str, segments: list[Segment],
                        speaker_map: dict[str, str], min_coverage: float = 0.3) -> dict | None:
    """Overlap-weighted average of the signals inside one of our utterances.
    Returns None when the provider covered too little of it (we don't guess)."""
    dur = max(end_s - start_s, 1e-6)
    used: list[tuple[Segment, float]] = []
    for s in segments:
        if not s.has_signals:
            continue
        if s.speaker is not None and speaker_map and speaker_map.get(s.speaker) != label:
            continue
        w = overlap(s.start, s.end, start_s, end_s)
        if w > 0:
            used.append((s, w))
    if not used:
        return None
    covered = min(1.0, _merge_len([(max(s.start, start_s), min(s.end, end_s)) for s, _ in used]) / dur)
    if covered < min_coverage:
        return None

    probs: dict[str, dict[str, float]] = {}
    for task in PROB_TASKS:
        labels: dict[str, list[tuple[float, float]]] = {}
        total_w = 0.0
        for s, w in used:
            if task in s.probs:
                total_w += w
                for lab, p in s.probs[task].items():
                    labels.setdefault(lab, []).append((p, w))
        if total_w > 0:
            probs[task] = {lab: sum(p * w for p, w in vals) / total_w for lab, vals in labels.items()}
    scores: dict[str, float] = {}
    for key in {k for s, _ in used for k in s.scores}:
        v = _wavg([(s.scores[key], w) for s, w in used if key in s.scores])
        if v is not None:
            scores[key] = v
    return {"coverage": round(covered, 3), "probs": probs, "scores": scores}


def _merge_len(spans: list[tuple[float, float]]) -> float:
    total, cur0, cur1 = 0.0, None, None
    for a, b in sorted(spans):
        if b <= a:
            continue
        if cur1 is None or a > cur1:
            if cur1 is not None:
                total += cur1 - cur0
            cur0, cur1 = a, b
        else:
            cur1 = max(cur1, b)
    if cur1 is not None:
        total += cur1 - cur0
    return total


def add_baselines(signals_by_key: dict, label_by_key: dict, min_points: int = 6) -> None:
    """Adds arousal_z / valence_z (robust: median & MAD) per speaker, in place.
    A naturally loud or flat speaker is compared with themselves, not with everyone."""
    for name in ("arousal", "valence"):
        by_label: dict[str, list] = {}
        for k, sig in signals_by_key.items():
            if sig and name in sig.get("scores", {}):
                by_label.setdefault(label_by_key[k], []).append(k)
        for keys in by_label.values():
            if len(keys) < min_points:
                continue
            vals = [signals_by_key[k]["scores"][name] for k in keys]
            med = median(vals)
            scale = max(1.4826 * median(abs(v - med) for v in vals), 0.05)
            for k in keys:
                signals_by_key[k][f"{name}_z"] = round((signals_by_key[k]["scores"][name] - med) / scale, 2)


# Provisional thresholds. They are the knob to tune after listening to real calls.
THRESHOLDS = {
    "lenient":  {"angry": 0.60, "shouting": 0.70, "neg": 0.65, "energy": 0.60, "z_arousal": 2.0, "z_valence": -1.5, "fast": 0.75},
    "balanced": {"angry": 0.45, "shouting": 0.50, "neg": 0.50, "energy": 0.50, "z_arousal": 1.5, "z_valence": -1.0, "fast": 0.65},
    "strict":   {"angry": 0.30, "shouting": 0.35, "neg": 0.40, "energy": 0.40, "z_arousal": 1.2, "z_valence": -0.8, "fast": 0.55},
}


def _p(probs: dict, task: str, *labels: str) -> float:
    d = probs.get(task) or {}
    return max((d.get(l, 0.0) for l in labels), default=0.0)


def _strength(value: float, threshold: float) -> str:
    return "high" if value >= threshold + 0.25 else "medium" if value >= threshold + 0.1 else "low"


def describe(signals: dict | None, sensitivity: str = "balanced") -> dict:
    """{'flags': [{key,label,strength}], 'cues': [str]}. Only measured things are named."""
    out = {"flags": [], "cues": []}
    if not signals:
        return out
    t = THRESHOLDS.get(sensitivity, THRESHOLDS["balanced"])
    probs, scores = signals.get("probs", {}), signals.get("scores", {})

    angry = _p(probs, "emotion", "angry", "anger")
    if angry >= t["angry"]:
        out["flags"].append({"key": "angry", "label": "Angry-sounding voice", "strength": _strength(angry, t["angry"])})
    shout = _p(probs, "shouting", "shouting", "yes", "true")
    if shout >= t["shouting"]:
        out["flags"].append({"key": "shouting", "label": "Raised or shouting voice", "strength": _strength(shout, t["shouting"])})
    neg, strong = _p(probs, "positivity", "negative"), _p(probs, "strength", "strong")
    if neg >= t["neg"] and strong >= t["energy"]:
        out["flags"].append({"key": "heated", "label": "Negative and intense delivery",
                             "strength": _strength(min(neg, strong), min(t["neg"], t["energy"]))})
    az, vz = signals.get("arousal_z"), signals.get("valence_z")
    if az is not None and vz is not None and az >= t["z_arousal"] and vz <= t["z_valence"]:
        out["flags"].append({"key": "agitated", "label": "More agitated than their own norm",
                             "strength": "high" if az >= t["z_arousal"] + 1 else "medium"})
    out["cues"] = [f["label"].lower() for f in out["flags"]]
    if _p(probs, "speaking_rate", "fast") >= t["fast"]:
        out["cues"].append("fast speech")   # minor cue only: never a flag on its own
    return out


def public_view(signals: dict | None, sensitivity: str = "balanced") -> dict | None:
    if not signals:
        return None
    d = describe(signals, sensitivity)
    probs, scores = signals.get("probs", {}), signals.get("scores", {})
    return {
        "coverage": signals.get("coverage"),
        "flags": d["flags"], "cues": d["cues"],
        "arousal": scores.get("arousal"), "valence": scores.get("valence"),
        "angry": _p(probs, "emotion", "angry", "anger") or None,
        "arousal_z": signals.get("arousal_z"), "valence_z": signals.get("valence_z"),
    }
