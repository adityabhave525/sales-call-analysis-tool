"""Step 2: see what our thresholds make of a call, per segment, at every sensitivity.
Uses the .voice_raw.json saved by voice_probe, so it costs nothing and can be re-run freely.

    python -m scripts.voice_report call.voice_raw.json [--speaker A] [--only-flagged]

Use it to calibrate: run it on your calm clip and your angry clip and compare.
If the angry clip shows no flags at 'strict', or the calm clip shows flags at 'balanced',
send me the output and we tune app/services/voice_features.py THRESHOLDS.
"""
import argparse
import json
from pathlib import Path

from app.services.voice_client import parse_results
from app.services.voice_features import THRESHOLDS, add_baselines, describe


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("raw_json")
    ap.add_argument("--speaker")
    ap.add_argument("--only-flagged", action="store_true")
    args = ap.parse_args()

    segs = [s for s in parse_results(json.loads(Path(args.raw_json).read_text())) if s.has_signals]
    sig = {i: {"coverage": 1.0, "probs": s.probs, "scores": dict(s.scores)} for i, s in enumerate(segs)}
    add_baselines(sig, {i: str(s.speaker) for i, s in enumerate(segs)})

    def f(x, nd=2):
        return "  -  " if x is None else f"{x:.{nd}f}"

    print(f"{'time':>11}  spk  angry  neg  strong  arou  vale  az    vz   flags (lenient | balanced | strict)")
    for i, s in enumerate(segs):
        if args.speaker and str(s.speaker) != args.speaker:
            continue
        g = sig[i]
        pr = s.probs
        flags = {lvl: [x["key"] for x in describe(g, lvl)["flags"]] for lvl in THRESHOLDS}
        if args.only_flagged and not any(flags.values()):
            continue
        a = max(pr.get("emotion", {}).get("angry", 0), pr.get("emotion", {}).get("anger", 0))
        print(f"{s.start:5.1f}-{s.end:5.1f}  {str(s.speaker):>3}  {f(a)}  {f(pr.get('positivity',{}).get('negative'))}  "
              f"{f(pr.get('strength',{}).get('strong'))}   {f(s.scores.get('arousal'))}  {f(s.scores.get('valence'))}  "
              f"{f(g.get('arousal_z'),1)}  {f(g.get('valence_z'),1)}  "
              + " | ".join(",".join(v) or "-" for v in flags.values()))


if __name__ == "__main__":
    main()
