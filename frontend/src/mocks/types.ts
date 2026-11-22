import type { ActionType, AnalysisOut, AnalysisSettings, JobOut, Severity, SpeakerOut } from "@/types/api"
import type { RawUtterance } from "./script"

/** What the (pretend) LLM proposes for tone. The mock then applies the backend's decision rules. */
export interface RawEvidence {
  utterance_index: number
  quote: string
  /** key of a tone criterion; ignored when that criterion is switched off in settings */
  criterion: string
  severity: Severity
  explanation: string
}

export interface RawAnalysis {
  /** true => the (pretend) model judged the rep's tone negative */
  negative: boolean
  confidence: number
  explanation: string
  evidence: RawEvidence[]
}

/** A candidate action item. Owner is derived from who spoke the line. */
export interface PoolItem {
  utterance_index: number
  quote: string
  description: string
  item_type: ActionType
  deadline_text: string | null
  confidence: number
  /** vague promise: dropped when specificity = "concrete_only" */
  loose?: boolean
  /** transcript doesn't make clear who owns it -> owner "Not specified" */
  ownerUnclear?: boolean
}

export interface ScenarioFailure {
  stage: "transcribing" | "analysing"
  message: string
}

/** A scripted call plus everything needed to mimic the backend's behaviour on it. */
export interface Scenario {
  key: string
  jobId: string
  filename: string
  sizeBytes: number
  language_code: string
  utterances: RawUtterance[]
  /** roles the backend would infer on the first successful analysis */
  inferredSpeakers: SpeakerOut[]
  summary: string
  /** What the pretend model says, given which label is currently the rep. */
  raw: (repLabel: string | null) => RawAnalysis
  pool: PoolItem[]
  failure?: ScenarioFailure
}

export type PlanKind = "full" | "reanalyse"

export interface MockJob {
  scenario: Scenario
  job: JobOut
  hasTranscript: boolean
  speakers: SpeakerOut[]
  /** includes failed runs, like the backend's analyses table */
  analyses: AnalysisOut[]
  /** in-flight work; status is computed from elapsed time when the job is read */
  plan: null | { kind: PlanKind; startedAt: number; settings: AnalysisSettings }
  /** how many more analysis attempts should fail (for the retry demo) */
  failuresLeft: number
}
