"""Step 1: confirm the Behavioral Signals API works with YOUR account and audio.

    python -m scripts.voice_probe path/to/call.m4a            # converts to WAV first (default)
    python -m scripts.voice_probe path/to/call.m4a --raw      # send the original file as-is (tests m4a support)

Prints the task names and a few raw rows (so parser field names can be checked),
then what our parser makes of them. Raw rows are saved next to the audio as
<name>.voice_raw.json so `python -m scripts.voice_report` can re-use them WITHOUT spending credits.
Each run uploads the audio and uses credits.
"""
import argparse
import json
import sys
import tempfile
from collections import Counter
from pathlib import Path

from app.config import config
from app.services.voice_client import _extract_items, _get, mean_quality, parse_results, prepare_audio


def to_plain(x):
    if isinstance(x, dict):
        return {k: to_plain(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [to_plain(v) for v in x]
    for attr in ("model_dump", "dict"):
        if hasattr(x, attr):
            try:
                return to_plain(getattr(x, attr)())
            except Exception:
                pass
    if hasattr(x, "__dict__"):
        return to_plain({k: v for k, v in vars(x).items() if not k.startswith("_")})
    return x


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--raw", action="store_true", help="upload the original file without converting")
    args = ap.parse_args()
    src = Path(args.audio)
    if not src.exists():
        print(f"File not found: {src}")
        return 1
    if not (config.behavioralsignals_cid and config.behavioralsignals_api_key):
        print("Set BEHAVIORALSIGNALS_CID and BEHAVIORALSIGNALS_API_KEY in backend/.env first.")
        return 1
    try:
        from behavioralsignals import Client
    except ImportError:
        print("Run: pip install behavioralsignals av")
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        if args.raw:
            audio = src
        else:
            audio = prepare_audio(src, Path(tmp))
        print(f"Uploading: {audio.name} ({audio.stat().st_size/1e6:.1f} MB)")
        client = Client(config.behavioralsignals_cid, config.behavioralsignals_api_key)
        try:
            proc = client.behavioral.upload_audio(file_path=str(audio))
        except Exception as exc:
            print(f"UPLOAD FAILED: {type(exc).__name__}: {exc} (status_code={getattr(exc, 'status_code', None)})")
            if args.raw:
                print("-> m4a may not be accepted directly. Run again without --raw.")
            return 2
        pid = _get(proc, "pid", "id")
        print(f"Process id: {pid}. Waiting for results (can take a few minutes)...")
        try:
            result = client.behavioral.wait_for_result(
                pid=pid, timeout=config.voice_timeout_s, continuous=["valence", "arousal"])
        except Exception as exc:
            print(f"RESULT FAILED: {type(exc).__name__}: {exc} (status_code={getattr(exc, 'status_code', None)})")
            return 3

    items = _extract_items(result)
    plain = to_plain(items)
    out = src.with_suffix(".voice_raw.json")
    out.write_text(json.dumps(plain, indent=2, default=str))
    print(f"\nResult object type: {type(result).__name__}; rows: {len(items)}; saved to {out}")
    tasks = Counter(str(_get(i, "task", default="?")) for i in items)
    print("Tasks returned:", dict(tasks))
    print("\nFirst 6 raw rows:")
    for row in plain[:6]:
        print(" ", json.dumps(row, default=str)[:400])

    segs = parse_results(items)
    spk = Counter(s.speaker for s in segs)
    print(f"\nParsed {len(segs)} segments; speakers: {dict(spk)}; mean quality: {mean_quality(segs)}")
    with_sig = [s for s in segs if s.has_signals]
    print(f"{len(with_sig)} segments carry signals. Signal kinds found:")
    kinds = Counter(k for s in with_sig for k in list(s.probs) + list(s.scores))
    print(" ", dict(kinds))
    if with_sig:
        s = with_sig[0]
        print("Example segment:", {"start": s.start, "end": s.end, "speaker": s.speaker, "probs": s.probs, "scores": s.scores})
    if not with_sig:
        print("\n!! No signals parsed. Send me the 'First 6 raw rows' output above and I will fix the parser.")
    print("\nNext: python -m scripts.voice_report", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
