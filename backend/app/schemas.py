from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------- Analysis settings (user-configurable, sent with each analysis) ----------

class ToneCriterion(BaseModel):
    key: str
    label: str
    enabled: bool = True
    definition: str


def default_criteria() -> list[ToneCriterion]:
    return [
        ToneCriterion(key="rudeness", label="Rudeness",
                      definition="Insults, sarcasm, mocking, or disrespectful language toward the customer."),
        ToneCriterion(key="hostility", label="Hostility",
                      definition="Aggression, threats, or blaming the customer."),
        ToneCriterion(key="dismissiveness", label="Dismissiveness",
                      definition="Brushing off concerns, ignoring questions, or minimising the customer's problem."),
        ToneCriterion(key="impatience", label="Impatience",
                      definition="Rushing the customer, cutting them off, or showing irritation at questions.",
                      enabled=False),
    ]


ActionType = Literal["commitment", "follow_up", "send_information", "schedule_meeting"]


class AnalysisSettings(BaseModel):
    llm_model: Literal["claude-haiku-5-5", "claude-sonnet-5-5"] = "claude-haiku-5-5"
    tone_sensitivity: Literal["lenient", "balanced", "strict"] = "balanced"
    # Minimum model confidence needed to label RED. Below this -> GREEN + "needs review".
    red_confidence_threshold: float = Field(0.6, ge=0.3, le=0.95)
    tone_criteria: list[ToneCriterion] = Field(default_factory=default_criteria)

    action_item_types: list[ActionType] = Field(
        default_factory=lambda: ["commitment", "follow_up", "send_information", "schedule_meeting"]
    )
    include_customer_actions: bool = True
    action_item_specificity: Literal["any", "concrete_only"] = "concrete_only"

    custom_instructions: str = Field("", max_length=1000)


class RepAssignment(BaseModel):
    rep_label: str


# ---------- API responses ----------

class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    size_bytes: int
    duration_ms: int | None
    status: str
    failed_stage: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class UtteranceOut(BaseModel):
    id: int
    idx: int
    speaker_label: str
    role: str
    start_ms: int
    end_ms: int
    text: str
    confidence: float | None


class SpeakerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    label: str
    role: str
    role_confidence: float | None
    role_source: str
    role_reasoning: str | None


class ToneEvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    utterance_id: int | None
    quote: str
    start_ms: int | None
    criterion: str | None
    severity: str
    explanation: str | None


class ActionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    utterance_id: int | None
    description: str
    item_type: str | None
    owner_role: str | None      # null => "Not specified"
    deadline_text: str | None   # null => "Not specified"
    quote: str
    start_ms: int | None
    confidence: float | None


class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version: int
    status: str
    llm_model: str
    settings_snapshot: dict
    tone: str | None
    tone_confidence: float | None
    needs_review: bool
    tone_explanation: str | None
    call_summary: str | None
    warnings: list[str]
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None
    tone_evidence: list[ToneEvidenceOut]
    action_items: list[ActionItemOut]


class VersionOut(BaseModel):
    version: int
    status: str
    tone: str | None
    llm_model: str
    created_at: datetime


class JobResultOut(BaseModel):
    job: JobOut
    language_code: str | None
    utterances: list[UtteranceOut]
    speakers: list[SpeakerOut]
    analysis: AnalysisOut | None
    versions: list[VersionOut]
