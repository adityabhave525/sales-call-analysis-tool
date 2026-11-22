"""Shapes Claude must return (via tool use). Deliberately permissive on numeric
ranges; app/services/postprocess.py clamps and validates semantically."""
from typing import Literal

from pydantic import BaseModel, Field


class RoleGuess(BaseModel):
    speaker: str = Field(description="The speaker label exactly as given, e.g. 'A'")
    role: Literal["rep", "customer", "unknown"]
    confidence: float = Field(description="0 to 1")
    reasoning: str = Field(description="One short sentence")


class RolesToolOutput(BaseModel):
    roles: list[RoleGuess]


class ToneEvidenceItem(BaseModel):
    utterance_index: int = Field(description="The [number] of the transcript line containing the quote")
    quote: str = Field(description="Word-for-word excerpt from that single line, spoken by the REP")
    criterion: str = Field(description="Key of the tone criterion this shows, or 'other'")
    severity: Literal["low", "medium", "high"]
    explanation: str = Field(description="Why this is negative, in one sentence")


class ActionItemOut(BaseModel):
    description: str = Field(description="Short imperative description of the task")
    item_type: Literal["commitment", "follow_up", "send_information", "schedule_meeting"]
    owner_role: Literal["rep", "customer"] | None = Field(
        default=None, description="Who committed, only if clear from the transcript; otherwise null")
    deadline_text: str | None = Field(
        default=None, description="Timing exactly as spoken, e.g. 'by Friday'; null if none was stated")
    utterance_index: int
    quote: str = Field(description="Word-for-word excerpt from that single line")
    confidence: float = Field(description="0 to 1")


class AnalysisToolOutput(BaseModel):
    rep_tone_negative: bool = Field(description="True only if the REP's tone was negative overall")
    tone_confidence: float = Field(description="0 to 1: how sure you are of this verdict, either way")
    tone_explanation: str = Field(description="2-3 sentences explaining the verdict, about the REP only")
    tone_evidence: list[ToneEvidenceItem] = Field(description="Empty if the rep's tone was not negative")
    action_items: list[ActionItemOut]
    call_summary: str = Field(description="2-3 sentence neutral summary of the call")
