from types import SimpleNamespace as NS

from app.services import voice_client as vc


def row(task, st, et, id_="1", **kw):
    return {"task": task, "startTime": str(st), "endTime": str(et), "id": id_, **kw}


def test_parse_groups_rows_by_id_and_reads_probabilities():
    items = [
        row("diarization", 0, 5, finalLabel="SPEAKER_00"),
        row("emotion", 0, 5, prediction=[{"label": "Angry", "posterior": "0.7"}, {"label": "neutral", "posterior": "0.3"}]),
        row("positivity", 0, 5, finalLabel="negative"),
        row("intensity", 0, 5, score="0.8"),
    ]
    (s,) = vc.parse_results(items)
    assert s.speaker == "SPEAKER_00"
    assert s.probs["emotion"]["angry"] == 0.7
    assert s.probs["positivity"] == {"negative": 1.0}
    assert s.scores["intensity"] == 0.8


def test_parse_accepts_objects_and_short_field_names():
    o = NS(task="emotion", st=1.0, et=2.0, id="9", prediction=[NS(label="angry", posterior="0.6")])
    (s,) = vc.parse_results([o])
    assert s.probs["emotion"]["angry"] == 0.6 and (s.start, s.end) == (1.0, 2.0)


def test_continuous_rows_inherit_speaker_by_time():
    items = [row("diarization", 0, 10, id_="a", finalLabel="S1"),
             row("continuous_arousal", 2, 3, id_="t1", score="0.9")]
    segs = vc.parse_results(items)
    cont = next(s for s in segs if "arousal" in s.scores)
    assert cont.speaker == "S1"


def test_bad_rows_are_skipped_not_fatal():
    assert vc.parse_results([{"task": "emotion"}, {"foo": 1}]) == []
    assert vc.parse_results(None) == []


def test_quality_scale_tolerated():
    s1 = vc.parse_results([row("signal_quality.overall", 0, 1, score="80")])
    assert vc.mean_quality(s1) == 0.8


def test_fetch_voice_unconfigured_never_raises(monkeypatch, tmp_path):
    monkeypatch.setattr(vc.config, "behavioralsignals_cid", "")
    r = vc.fetch_voice(tmp_path / "x.m4a")
    assert r.status == "unavailable" and "words" in r.message


def test_friendly_errors():
    class E(Exception):
        status_code = 401
    assert "CID" in vc._friendly(E())
    assert "timed out" in vc._friendly(TimeoutError())
