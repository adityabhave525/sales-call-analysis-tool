from app.services.postprocess import UttView, normalize_roles, postprocess

U = [
    UttView(0, "A", "rep", 0, "Hi, thanks for calling Acme. How can I help?", 10),
    UttView(1, "B", "customer", 5000, "My invoice is wrong and nobody has fixed it.", 11),
    UttView(2, "A", "rep", 9000, "Look, that's not my department. You'll have to wait.", 12),
    UttView(3, "B", "customer", 14000, "This is ridiculous, you are useless!", 13),
    UttView(4, "A", "rep", 18000, "I'll send you the corrected invoice by Friday.", 14),
]
KW = dict(red_threshold=0.6, allowed_types=["commitment", "follow_up", "send_information"],
          include_customer=True, rep_role_confidence=0.9)


def raw(**over):
    base = {
        "rep_tone_negative": True, "tone_confidence": 0.85, "tone_explanation": "Dismissive.",
        "tone_evidence": [{"utterance_index": 2, "quote": "that's not my department",
                           "criterion": "dismissiveness", "severity": "medium", "explanation": "Brushes off."}],
        "action_items": [], "call_summary": "Invoice complaint.",
    }
    base.update(over)
    return base


def test_red_when_negative_confident_and_verified_rep_quote():
    o = postprocess(raw(), U, **KW)
    assert o.tone == "RED" and len(o.evidence) == 1 and not o.needs_review


def test_fabricated_quote_prevents_red():
    r = raw(tone_evidence=[{"utterance_index": 2, "quote": "shut up and wait", "severity": "high"}])
    o = postprocess(r, U, **KW)
    assert o.tone == "GREEN" and o.needs_review and o.evidence == []
    assert any("could not be found" in w for w in o.warnings)


def test_customer_quote_is_not_valid_tone_evidence():
    r = raw(tone_evidence=[{"utterance_index": 3, "quote": "you are useless", "severity": "high"}])
    o = postprocess(r, U, **KW)
    assert o.tone == "GREEN" and o.evidence == []
    assert any("customer" in w for w in o.warnings)


def test_low_confidence_below_threshold_is_green_needs_review():
    o = postprocess(raw(tone_confidence=0.55), U, **KW)
    assert o.tone == "GREEN" and o.needs_review


def test_threshold_is_configurable():
    o = postprocess(raw(tone_confidence=0.7), U, **{**KW, "red_threshold": 0.9})
    assert o.tone == "GREEN" and o.needs_review
    o = postprocess(raw(tone_confidence=0.7), U, **{**KW, "red_threshold": 0.5})
    assert o.tone == "RED"


def test_no_rep_identified_means_green_needs_review():
    unknown = [UttView(u.idx, u.speaker, "unknown", u.start_ms, u.text, u.db_id) for u in U]
    o = postprocess(raw(), unknown, **KW)
    assert o.tone == "GREEN" and o.needs_review and o.tone_confidence is None


def test_low_role_confidence_flags_review():
    o = postprocess(raw(), U, **{**KW, "rep_role_confidence": 0.4})
    assert o.needs_review


def test_non_english_flags_review():
    o = postprocess(raw(), U, language_code="es", **KW)
    assert o.needs_review and any("language" in w.lower() for w in o.warnings)


def item(**over):
    base = {"description": "Send corrected invoice", "item_type": "send_information",
            "owner_role": "rep", "deadline_text": "by Friday", "utterance_index": 4,
            "quote": "I'll send you the corrected invoice by Friday", "confidence": 0.9}
    base.update(over)
    return base


def test_action_item_kept_with_supported_deadline():
    o = postprocess(raw(rep_tone_negative=False, tone_evidence=[], action_items=[item()]), U, **KW)
    a = o.action_items[0]
    assert a["owner_role"] == "rep" and a["deadline_text"] == "by Friday" and a["start_ms"] == 18000


def test_invented_deadline_is_nulled():
    o = postprocess(raw(action_items=[item(deadline_text="by Tuesday")]), U, **KW)
    assert o.action_items[0]["deadline_text"] is None
    assert any("deadline" in w for w in o.warnings)


def test_unverifiable_action_item_is_dropped():
    o = postprocess(raw(action_items=[item(quote="I will personally call your boss tomorrow")]), U, **KW)
    assert o.action_items == []


def test_invalid_owner_becomes_none():
    o = postprocess(raw(action_items=[item(owner_role="manager")]), U, **KW)
    assert o.action_items[0]["owner_role"] is None


def test_disabled_types_and_customer_items_filtered():
    r = raw(action_items=[item(item_type="schedule_meeting"), item(owner_role="customer")])
    o = postprocess(r, U, **{**KW, "include_customer": False})
    assert o.action_items == []


def test_duplicates_removed():
    o = postprocess(raw(action_items=[item(), item()]), U, **KW)
    assert len(o.action_items) == 1


def test_garbage_input_does_not_crash():
    o = postprocess({"rep_tone_negative": "yes", "tone_confidence": "high", "tone_evidence": [{}], "action_items": [{}]}, U, **KW)
    assert o.tone == "GREEN"


# ---- role normalisation ----
def test_roles_infer_opposite_for_two_speakers():
    r = normalize_roles([{"speaker": "A", "role": "rep", "confidence": 0.9, "reasoning": "greets"}], ["A", "B"])
    assert r["A"][0] == "rep" and r["B"][0] == "customer"


def test_roles_only_one_rep():
    r = normalize_roles([{"speaker": "A", "role": "rep", "confidence": 0.9},
                         {"speaker": "B", "role": "rep", "confidence": 0.6}], ["A", "B"])
    assert [v[0] for v in r.values()].count("rep") == 1


def test_roles_same_role_for_both_becomes_unknown():
    r = normalize_roles([{"speaker": "A", "role": "customer"}, {"speaker": "Speaker B", "role": "customer"}], ["A", "B"])
    assert r["A"][0] == "unknown" and r["B"][0] == "unknown"


def test_roles_empty_output():
    assert normalize_roles([], ["A"])["A"][0] == "unknown"
