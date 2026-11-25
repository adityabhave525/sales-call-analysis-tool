from app.services.voice_features import (
    Segment, add_baselines, aggregate_utterance, describe, map_speakers, public_view,
)


def seg(a, b, spk="X", **probs):
    return Segment(a, b, spk, probs={k: v for k, v in probs.items()})


def test_map_speakers_one_to_one_by_overlap():
    ours = [("A", 0, 10), ("B", 10, 20)]
    segs = [seg(0, 10, "s1"), seg(10, 20, "s2")]
    assert map_speakers(ours, segs) == {"s1": "A", "s2": "B"}


def test_map_speakers_swapped_ids_still_map_by_time():
    ours = [("A", 0, 10), ("B", 10, 20)]
    segs = [seg(0, 10, "s2"), seg(10, 20, "s1")]
    assert map_speakers(ours, segs) == {"s2": "A", "s1": "B"}


def test_map_speakers_empty():
    assert map_speakers([], []) == {}


def test_aggregate_weighted_by_overlap():
    segs = [Segment(0, 6, "s", probs={"emotion": {"angry": 1.0}}),
            Segment(6, 10, "s", probs={"emotion": {"angry": 0.0}})]
    out = aggregate_utterance(0, 10, "A", segs, {"s": "A"})
    assert abs(out["probs"]["emotion"]["angry"] - 0.6) < 1e-6 and out["coverage"] == 1.0


def test_aggregate_ignores_other_speaker_and_low_coverage():
    segs = [Segment(0, 10, "s2", probs={"emotion": {"angry": 1.0}})]
    assert aggregate_utterance(0, 10, "A", segs, {"s2": "B"}) is None
    sparse = [Segment(0, 1, "s", probs={"emotion": {"angry": 1.0}})]
    assert aggregate_utterance(0, 10, "A", sparse, {"s": "A"}, min_coverage=0.3) is None


def test_baselines_need_enough_points_and_flag_outlier():
    sig = {i: {"scores": {"arousal": 0.40 + 0.01 * (i % 3), "valence": 0.0}} for i in range(8)}
    sig[7]["scores"]["arousal"] = 0.95
    sig[7]["scores"]["valence"] = -0.8
    add_baselines(sig, {i: "A" for i in range(8)})
    assert sig[7]["arousal_z"] > 3 and sig[7]["valence_z"] < -3
    few = {i: {"scores": {"arousal": 0.5}} for i in range(3)}
    add_baselines(few, {i: "A" for i in range(3)})
    assert "arousal_z" not in few[0]


def test_sensitivity_changes_flags():
    sig = {"probs": {"emotion": {"angry": 0.5}}, "scores": {}}
    assert describe(sig, "lenient")["flags"] == []
    assert [f["key"] for f in describe(sig, "balanced")["flags"]] == ["angry"]
    assert describe(None)["flags"] == []


def test_fast_speech_is_cue_not_flag():
    d = describe({"probs": {"speaking_rate": {"fast": 0.9}}, "scores": {}}, "balanced")
    assert d["flags"] == [] and d["cues"] == ["fast speech"]


def test_heated_needs_negative_and_strong():
    sig = {"probs": {"positivity": {"negative": 0.8}, "strength": {"strong": 0.8}}, "scores": {}}
    assert [f["key"] for f in describe(sig)["flags"]] == ["heated"]
    sig["probs"]["strength"]["strong"] = 0.1
    assert describe(sig)["flags"] == []


def test_public_view_none_when_no_signals():
    assert public_view(None) is None
    pv = public_view({"coverage": 1.0, "probs": {"emotion": {"angry": 0.7}}, "scores": {"arousal": 0.8}})
    assert pv["flags"][0]["key"] == "angry" and pv["arousal"] == 0.8
