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
                      definition="Aggression, raised-voice language, threats, or blaming the customer."),
        ToneCriterion(key="dismissiveness", label="Dismissiveness",
                      definition="Brushing off concerns, ignoring questions, or minimising the customer's problem."),
        ToneCriterion(key="impatience", label="Impatience",
                      definition="Rushing the customer, sighing, or cutting them off.", enabled=False),
    ]


class AnalysisSettings(BaseModel):
    llm_model: str = "claude-haiku-5-5"
    tone_sensitivity: Literal["lenient", "balanced", "strict"] = "balanced"
    # Minimum model confidence needed to label RED. Below this -> GREEN + "needs review".
    red_confidence_threshold: float = Field(0.6, ge=0.3, le=0.95)
    tone_criteria: list[ToneCriterion] = Field(default_factory=default_criteria)

    action_item_types: list[
        Literal["commitment", "follow_up", "send_information", "schedule_meeting"]
    ] = Field(default_factory=lambda: ["commitment", "follow_up", "send_information", "schedule_meeting"])
    include_customer_actions: bool = True
    action_item_specificity: Literal["any", "concrete_only"] = "concrete_only"

    custom_instructions: str = Field("", max_length=1000)


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
