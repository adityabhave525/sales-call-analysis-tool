/**
 * TypeScript mirror of the backend API (backend/app/schemas.py).
 * Field names are snake_case on purpose: what the backend sends is what the
 * frontend uses, so there is no mapping layer to get wrong.
 *
 * Keep in sync with schemas.py. Dates arrive as ISO strings; parse them with
 * parseServerDate() in lib/format.ts (the backend sends UTC without a "Z").
 */

// ---------- Shared enums ----------
export type Tone = "RED" | "GREEN"
export type Role = "rep" | "customer" | "unknown"
export type RoleSource = "auto" | "user"
export type Severity = "low" | "medium" | "high"
export type JobStatus = "queued" | "transcribing" | "analysing" | "completed" | "failed"
export type AnalysisStatus = "running" | "completed" | "failed"

export type ToneSensitivity = "lenient" | "balanced" | "strict"
export type ActionType = "commitment" | "follow_up" | "send_information" | "schedule_meeting"
export type ActionSpecificity = "any" | "concrete_only"
export type LlmModel = "claude-haiku-5-5" | "claude-sonnet-5-5"
/** off: ignore voice | supporting: voice backs up the words | strong: voice alone can justify RED */
export type VoiceMode = "off" | "supporting" | "strong"
/** What a piece of tone evidence rests on. null/absent on analyses made before voice existed. */
export type EvidenceBasis = "words" | "voice" | "words_and_voice"

// ---------- Settings (sent with each upload / re-analysis) ----------
export interface ToneCriterion {
  key: string // snake_case id the model cites, e.g. "rudeness"
  label: string
  enabled: boolean
  definition: string
}

export interface AnalysisSettings {
  llm_model: LlmModel
  tone_sensitivity: ToneSensitivity
  /** 0.3 - 0.95. Minimum model confidence required to mark a call RED. */
  tone_criteria: ToneCriterion[]
  action_item_types: ActionType[]
  include_customer_actions: boolean
  action_item_specificity: ActionSpecificity
  voice_mode: VoiceMode
  /** max 1000 chars */
  custom_instructions: string
}

// ---------- Responses ----------
export interface JobOut {
  id: string
  original_filename: string
  size_bytes: number
  duration_ms: number | null
  status: JobStatus
  /** "transcribing" | "analysing" | "processing" | "interrupted" | null */
  failed_stage: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface VoiceFlagOut {
  key: string // "angry" | "shouting" | "heated" | "agitated"
  label: string
  strength: "low" | "medium" | "high"
}

/** Measured vocal signals for one line. Flags already reflect the analysis's sensitivity. */
export interface UtteranceVoiceOut {
  coverage: number | null
  flags: VoiceFlagOut[]
  cues: string[]
  /** 0-1 energy and -1..1 positivity; null when the provider didn't return them */
  arousal: number | null
  valence: number | null
  angry: number | null
  /** how far from this speaker's own norm, in robust standard deviations */
  arousal_z: number | null
  valence_z: number | null
}

export interface VoiceStatusOut {
  status: "ok" | "failed" | "unavailable"
  message: string | null
  quality: number | null
  coverage: number | null
}

export interface UtteranceOut {
  id: number
  idx: number
  speaker_label: string // raw diarization label: "A", "B"
  role: Role
  start_ms: number
  end_ms: number
  text: string
  confidence: number | null
  /** absent when voice analysis is off or unavailable for this line */
  voice?: UtteranceVoiceOut | null
}

export interface SpeakerOut {
  label: string
  role: Role
  role_confidence: number | null
  role_source: RoleSource
  role_reasoning: string | null
}

export interface ToneEvidenceOut {
  id: number
  utterance_id: number | null
  quote: string
  start_ms: number | null
  criterion: string | null
  severity: Severity
  explanation: string | null
  basis?: EvidenceBasis | null
  /** measured vocal cues on that line, e.g. "angry-sounding voice" */
  voice_cues?: string[] | null
  /** set when one of the user's rules excused this behaviour; it is shown but did not count toward the verdict */
  dismissed_by_rule?: string | null
}

export interface ActionItemOut {
  id: number
  utterance_id: number | null
  description: string
  item_type: ActionType | null
  /** null => show "Not specified" */
  owner_role: "rep" | "customer" | null
  /** as spoken, e.g. "by Friday". null => show "Not specified" */
  deadline_text: string | null
  quote: string
  start_ms: number | null
  confidence: number | null
}

/** What the backend stores per analysis: the settings used, plus which roles were assigned at the time. */
export type AnalysisSnapshot = AnalysisSettings & {
  /** speaker label -> role used for this run. Absent on analyses made before this was recorded. */
  roles_used?: Record<string, Role>
}

export interface AnalysisOut {
  id: number
  version: number
  status: AnalysisStatus
  llm_model: string
  /** The exact settings this run used. Compare with current settings to show "settings changed". */
  settings_snapshot: AnalysisSnapshot
  tone: Tone | null
  tone_confidence: number | null
  needs_review: boolean
  tone_explanation: string | null
  call_summary: string | null
  /** e.g. dropped unverifiable quotes, low-confidence roles */
  warnings: string[]
  error_message: string | null
  created_at: string
  completed_at: string | null
  tone_evidence: ToneEvidenceOut[]
  action_items: ActionItemOut[]
}

export interface VersionOut {
  version: number
  status: AnalysisStatus
  tone: Tone | null
  llm_model: string
  created_at: string
}

export interface JobResultOut {
  job: JobOut
  language_code: string | null
  utterances: UtteranceOut[]
  speakers: SpeakerOut[]
  /** null until the first analysis completes */
  analysis: AnalysisOut | null
  versions: VersionOut[]
  voice?: VoiceStatusOut | null
}

// ---------- Requests ----------
export interface RepAssignment {
  rep_label: string
}

// ---------- Misc ----------
export interface HealthOut {
  status: "ok"
  assemblyai_key_set: boolean
  anthropic_key_set: boolean
  /** absent on older backends */
  behavioralsignals_key_set?: boolean
}

/** FastAPI error shapes: HTTPException => string, validation => list. */
export interface ValidationIssue {
  loc: (string | number)[]
  msg: string
  type: string
}
export interface ApiErrorBody {
  detail: string | ValidationIssue[]
}
