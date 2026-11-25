"""The interviewer's case: 'That's not my problem' said angrily reads as neutral in text."""
from types import SimpleNamespace as NS

from app.services.postprocess import UttView, postprocess
from app.services.prompts import build_system_prompt, build_user_message, format_transcript

ANGRY = {"flags": [{"key": "angry", "label": "Angry-sounding voice", "strength": "high"}],
         "cues": ["angry-sounding voice"]}


def utts(voice=ANGRY):
    return [
        UttView(0, "A", "customer", 0, "My order never arrived.", 1),
        UttView(1, "B", "rep", 3000, "That's not my problem.", 2, voice),
        UttView(2, "A", "customer", 6000, "Okay then.", 3),
    ]


KW = dict(red_threshold=0.6, allowed_types=["commitment"], include_customer=True, rep_role_confidence=0.9)


def raw(basis, neg=True, conf=0.85):
    return {"rep_tone_negative": neg, "tone_confidence": conf, "tone_explanation": "x", "call_summary": "",
            "tone_evidence": [{"utterance_index": 1, "quote": "That's not my problem.", "criterion": "hostility",
                               "severity": "high", "explanation": "e", "basis": basis}], "action_items": []}


def test_voice_only_red_needs_strong_mode():
    sup = postprocess(raw("voice"), utts(), voice_mode="supporting", voice_available=True, **KW)
    assert sup.tone == "GREEN" and sup.needs_review and any("Strong" in w for w in sup.warnings)
    strong = postprocess(raw("voice"), utts(), voice_mode="strong", voice_available=True, **KW)
    assert strong.tone == "RED"
    assert strong.evidence[0]["basis"] == "voice" and strong.evidence[0]["voice_cues"] == ["angry-sounding voice"]


def test_words_and_voice_counts_in_supporting_mode():
    o = postprocess(raw("words_and_voice"), utts(), voice_mode="supporting", voice_available=True, **KW)
    assert o.tone == "RED" and o.evidence[0]["basis"] == "words_and_voice"


def test_unmeasured_voice_claim_is_removed_or_downgraded():
    o = postprocess(raw("voice"), utts(voice=None), voice_mode="strong", voice_available=True, **KW)
    assert o.tone == "GREEN" and o.evidence == [] and any("no measured voice" in w for w in o.warnings)
    o2 = postprocess(raw("words_and_voice"), utts(voice=None), voice_mode="strong", voice_available=True, **KW)
    assert o2.evidence[0]["basis"] == "words" and o2.tone == "RED"


def test_voice_off_ignores_voice_and_stays_silent_about_it():
    o = postprocess(raw("voice"), utts(), voice_mode="off", voice_available=False, voice_note="unavailable", **KW)
    assert o.evidence == [] and not any("voice" in w.lower() for w in o.warnings)


def test_voice_failure_note_is_shown_when_voice_wanted():
    o = postprocess(raw("words"), utts(voice=None), voice_mode="supporting", voice_available=False,
                    voice_note="Voice analysis failed.", **KW)
    assert o.tone == "RED" and "Voice analysis failed." in o.warnings


def test_low_audio_quality_asks_for_review():
    o = postprocess(raw("words_and_voice"), utts(), voice_mode="supporting", voice_available=True,
                    voice_quality=0.2, **KW)
    assert o.needs_review and any("quality" in w for w in o.warnings)


def test_prompt_mentions_voice_only_when_available():
    s = NS(tone_sensitivity="balanced", tone_criteria=[], action_item_types=["commitment"],
           include_customer_actions=True, action_item_specificity="any", custom_instructions="", voice_mode="strong")
    assert "VOICE SIGNALS" in build_system_prompt(s, voice_available=True)
    assert "VOICE SIGNALS" not in build_system_prompt(s, voice_available=False)
    s.voice_mode = "off"
    assert "VOICE SIGNALS" not in build_system_prompt(s, voice_available=True)


def test_transcript_shows_cues_for_rep_lines_only():
    u = utts()
    u[0].voice = ANGRY
    t = format_transcript(u)
    assert t.count("{voice:") == 1 and "That's not my problem. {voice: angry-sounding voice}" in t
    assert "Voice notes" in build_user_message(u, True) and "No voice analysis" in build_user_message(u, False)
