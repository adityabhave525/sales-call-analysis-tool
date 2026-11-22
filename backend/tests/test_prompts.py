from types import SimpleNamespace as NS

from app.services.postprocess import UttView
from app.services.prompts import build_system_prompt, build_user_message, mmss
from app.services.schema_utils import inline_refs


def settings(**over):
    base = dict(
        tone_sensitivity="balanced",
        tone_criteria=[NS(key="rudeness", label="Rudeness", enabled=True, definition="Insults."),
                       NS(key="impatience", label="Impatience", enabled=False, definition="Rushing.")],
        action_item_types=["commitment", "send_information"],
        include_customer_actions=True, action_item_specificity="concrete_only",
        custom_instructions="",
    )
    base.update(over)
    return NS(**base)


def test_only_enabled_criteria_in_prompt():
    p = build_system_prompt(settings())
    assert "rudeness" in p and "impatience" not in p


def test_sensitivity_changes_prompt():
    assert "lenient" in build_system_prompt(settings(tone_sensitivity="lenient")).lower()
    assert "strict" in build_system_prompt(settings(tone_sensitivity="strict")).lower()


def test_no_criteria_enabled_forces_green_instruction():
    s = settings(tone_criteria=[NS(key="x", label="X", enabled=False, definition="d")])
    assert "No tone criteria are enabled" in build_system_prompt(s)


def test_action_type_and_customer_rules():
    p = build_system_prompt(settings(include_customer_actions=False))
    assert "send_information" in p and "schedule_meeting" not in p
    assert "Do not extract commitments made by the customer" in p


def test_custom_instructions_are_labelled_and_subordinate():
    p = build_system_prompt(settings(custom_instructions="We sell insurance."))
    assert "We sell insurance." in p and "never override" in p


def test_transcript_format_numbers_lines_and_uses_roles():
    u = [UttView(0, "A", "rep", 0, "Hello."), UttView(1, "B", "unknown", 65000, "Hi.")]
    m = build_user_message(u)
    assert "[0] [00:00] REP: Hello." in m and "[1] [01:05] SPEAKER B: Hi." in m and "<transcript>" in m


def test_mmss():
    assert mmss(125000) == "02:05"


def test_inline_refs_removes_defs():
    schema = {"type": "object", "$defs": {"Item": {"type": "object", "properties": {"a": {"type": "string"}}}},
              "properties": {"items": {"type": "array", "items": {"$ref": "#/$defs/Item"}}}}
    out = inline_refs(schema)
    assert "$defs" not in str(out) and "$ref" not in str(out)
    assert out["properties"]["items"]["items"]["properties"]["a"]["type"] == "string"
