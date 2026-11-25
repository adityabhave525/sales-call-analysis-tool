"""SQLite schema.

jobs 1─1 transcripts 1─* utterances
jobs 1─* speakers            (who is rep/customer; user-editable)
jobs 1─* analyses            (one per run; re-analysis adds a new version)
analyses 1─* tone_evidence
analyses 1─* action_items
jobs 1─1 voice_analyses      (provider voice fetch status; fetched once, reused on re-analysis)
utterances 1─1 utterance_voice   (aggregated voice signals per utterance)
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index,
    Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class JobStatus(str, enum.Enum):
    QUEUED = "queued"
    TRANSCRIBING = "transcribing"
    ANALYSING = "analysing"
    COMPLETED = "completed"
    FAILED = "failed"


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued','transcribing','analysing','completed','failed')",
            name="ck_jobs_status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str] = mapped_column(String(255))  # uuid + extension on disk
    content_type: Mapped[str | None] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)

    status: Mapped[str] = mapped_column(String(20), default=JobStatus.QUEUED.value, index=True)
    failed_stage: Mapped[str | None] = mapped_column(String(30))   # transcribing | analysing
    error_message: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    transcript: Mapped["Transcript | None"] = relationship(
        back_populates="job", uselist=False, cascade="all, delete-orphan"
    )
    speakers: Mapped[list["Speaker"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
    analyses: Mapped[list["Analysis"]] = relationship(
        back_populates="job", cascade="all, delete-orphan", order_by="Analysis.version"
    )
    voice: Mapped["VoiceAnalysis | None"] = relationship(
        back_populates="job", uselist=False, cascade="all, delete-orphan"
    )


class Transcript(Base):
    """Stored once per job so re-analysis never re-pays for transcription."""
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), unique=True
    )
    provider: Mapped[str] = mapped_column(String(30), default="assemblyai")
    provider_transcript_id: Mapped[str | None] = mapped_column(String(100))
    language_code: Mapped[str | None] = mapped_column(String(10))
    full_text: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    job: Mapped[Job] = relationship(back_populates="transcript")
    utterances: Mapped[list["Utterance"]] = relationship(
        back_populates="transcript", cascade="all, delete-orphan", order_by="Utterance.idx"
    )


class Utterance(Base):
    """One speaker turn. Evidence quotes are verified against these rows."""
    __tablename__ = "utterances"
    __table_args__ = (Index("ix_utterances_transcript_idx", "transcript_id", "idx"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transcript_id: Mapped[int] = mapped_column(ForeignKey("transcripts.id", ondelete="CASCADE"))
    idx: Mapped[int] = mapped_column(Integer)                 # order within the call
    speaker_label: Mapped[str] = mapped_column(String(10))    # raw diarization label: "A", "B"
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float)

    transcript: Mapped[Transcript] = relationship(back_populates="utterances")
    voice: Mapped["UtteranceVoice | None"] = relationship(
        back_populates="utterance", uselist=False, cascade="all, delete-orphan"
    )


class Speaker(Base):
    """Maps a diarization label to a role. Lives on the job (not the analysis)
    so a user's rep/customer swap survives re-analysis."""
    __tablename__ = "speakers"
    __table_args__ = (
        UniqueConstraint("job_id", "label", name="uq_speakers_job_label"),
        CheckConstraint("role IN ('rep','customer','unknown')", name="ck_speakers_role"),
        CheckConstraint("role_source IN ('auto','user')", name="ck_speakers_source"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(10))
    role: Mapped[str] = mapped_column(String(10), default="unknown")
    role_confidence: Mapped[float | None] = mapped_column(Float)
    role_source: Mapped[str] = mapped_column(String(10), default="auto")
    role_reasoning: Mapped[str | None] = mapped_column(Text)

    job: Mapped[Job] = relationship(back_populates="speakers")


class Analysis(Base):
    """One LLM run. Re-analysis with new settings inserts version N+1."""
    __tablename__ = "analyses"
    __table_args__ = (
        UniqueConstraint("job_id", "version", name="uq_analyses_job_version"),
        CheckConstraint("tone IS NULL OR tone IN ('RED','GREEN')", name="ck_analyses_tone"),
        CheckConstraint("status IN ('running','completed','failed')", name="ck_analyses_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(10), default="running")

    llm_model: Mapped[str] = mapped_column(String(60))
    settings_snapshot: Mapped[dict] = mapped_column(JSON)  # exact settings used, for reproducibility

    tone: Mapped[str | None] = mapped_column(String(5))
    tone_confidence: Mapped[float | None] = mapped_column(Float)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    tone_explanation: Mapped[str | None] = mapped_column(Text)
    call_summary: Mapped[str | None] = mapped_column(Text)

    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    # Human-readable notes: dropped unverifiable quotes, low-confidence roles, etc.
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    job: Mapped[Job] = relationship(back_populates="analyses")
    tone_evidence: Mapped[list["ToneEvidence"]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )
    action_items: Mapped[list["ActionItem"]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )


class ToneEvidence(Base):
    __tablename__ = "tone_evidence"
    __table_args__ = (
        CheckConstraint("severity IN ('low','medium','high')", name="ck_tone_evidence_severity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"), index=True)
    utterance_id: Mapped[int | None] = mapped_column(ForeignKey("utterances.id", ondelete="SET NULL"))
    quote: Mapped[str] = mapped_column(Text)            # verbatim from transcript
    start_ms: Mapped[int | None] = mapped_column(Integer)
    criterion: Mapped[str | None] = mapped_column(String(50))   # e.g. "dismissive"
    severity: Mapped[str] = mapped_column(String(10), default="medium")
    explanation: Mapped[str | None] = mapped_column(Text)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)  # quote found in transcript?
    basis: Mapped[str | None] = mapped_column(String(20))           # words | voice | words_and_voice
    voice_cues: Mapped[list | None] = mapped_column(JSON)           # measured cues on that line

    analysis: Mapped[Analysis] = relationship(back_populates="tone_evidence")


class ActionItem(Base):
    __tablename__ = "action_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"), index=True)
    utterance_id: Mapped[int | None] = mapped_column(ForeignKey("utterances.id", ondelete="SET NULL"))
    description: Mapped[str] = mapped_column(Text)
    item_type: Mapped[str | None] = mapped_column(String(30))   # commitment | follow_up | ...
    # Nullable on purpose: never invent owners or deadlines.
    owner_role: Mapped[str | None] = mapped_column(String(10))  # rep | customer | NULL
    deadline_text: Mapped[str | None] = mapped_column(String(100))  # as spoken: "by Friday"
    quote: Mapped[str] = mapped_column(Text)
    start_ms: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[float | None] = mapped_column(Float)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    analysis: Mapped[Analysis] = relationship(back_populates="action_items")


class VoiceAnalysis(Base):
    """Result of the voice-provider call for a job. One per job: the (paid) call is made
    once and re-analysis reuses it. status 'failed'/'unavailable' means tone falls back to words."""
    __tablename__ = "voice_analyses"
    __table_args__ = (
        CheckConstraint("status IN ('ok','failed','unavailable')", name="ck_voice_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), unique=True)
    provider: Mapped[str] = mapped_column(String(30), default="behavioralsignals")
    provider_process_id: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(12))
    message: Mapped[str | None] = mapped_column(Text)
    quality: Mapped[float | None] = mapped_column(Float)     # 0-1 recording quality
    coverage: Mapped[float | None] = mapped_column(Float)    # share of utterances with usable signals
    speaker_map: Mapped[dict | None] = mapped_column(JSON)   # provider speaker -> our label
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    job: Mapped[Job] = relationship(back_populates="voice")


class UtteranceVoice(Base):
    """Raw aggregated signals (probabilities/scores) for one utterance. Flags are derived
    at read time from the user's current sensitivity, so no new API call is ever needed."""
    __tablename__ = "utterance_voice"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    utterance_id: Mapped[int] = mapped_column(ForeignKey("utterances.id", ondelete="CASCADE"), unique=True)
    signals: Mapped[dict] = mapped_column(JSON)

    utterance: Mapped[Utterance] = relationship(back_populates="voice")
