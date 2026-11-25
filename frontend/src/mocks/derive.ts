/**
 * DEMO LOGIC, NOT THE REAL ANALYSIS. A small TypeScript port of the backend's
 * decision rules (backend/app/services/postprocess.py), run on scripted "model
 * output", so that changing settings or swapping roles in the UI visibly changes
 * the result exactly the way the real app will.
 */
import type {
  ActionItemOut,
  AnalysisOut,
  AnalysisSettings,
  Role,
  SpeakerOut,
  ToneEvidenceOut,
} from "@/types/api"
import { quoteInText, type RawUtterance } from "./script"
import type { RawAnalysis, Scenario } from "./types"

const LOW_CONFIDENCE = 0.6
/** Stand-in for how strict prompting shifts the model's confidence. */
const SENSITIVITY_DELTA = { lenient: -0.2, balanced: 0, strict: 0.1 } as const

export const NO_ISSUES_RAW: RawAnalysis = {
  negative: false,
  confidence: 0.5,
  explanation: "No negative tone was found in the lines attributed to the rep.",
  evidence: [],
}

let idCounter = 1000
const nextId = () => ++idCounter

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const pct = (x: number) => `${Math.round(x * 100)}%`

export interface DeriveInput {
  scenario: Scenario
  utterances: readonly RawUtterance[]
  speakers: readonly SpeakerOut[]
  settings: AnalysisSettings
  version: number
  /** naive-UTC ISO string, like the backend sends */
  createdAt: string
  completedAt: string
}

export function deriveAnalysis(input: DeriveInput): AnalysisOut {
  const { scenario, utterances, speakers, settings } = input
  const byIdx = new Map(utterances.map((u) => [u.idx, u]))
  const roleOf = (label: string): Role => speakers.find((s) => s.label === label)?.role ?? "unknown"

  const rep = speakers.find((s) => s.role === "rep")
  const repConfidence = rep ? (rep.role_source === "user" ? 1 : rep.role_confidence) : null
  const raw = scenario.raw(rep?.label ?? null)
  const warnings: string[] = []
  let needsReview = false

  // 1. tone evidence: only criteria the user switched on can produce evidence
  const enabled = new Set(settings.tone_criteria.filter((c) => c.enabled).map((c) => c.key))
  const candidates = raw.evidence.filter((e) => enabled.has(e.criterion))
  const modelNegative = raw.negative && candidates.length > 0

  const voiceOn = settings.voice_mode !== "off" && !!scenario.voice
  let droppedVoice = 0
  let downgradedVoice = 0
  if (settings.voice_mode !== "off" && !scenario.voice) {
    warnings.push("Voice analysis is not configured (no Behavioral Signals keys), so tone was judged from the words only.")
  }

  let droppedUnverified = 0
  let droppedNotRep = 0
  const evidence: ToneEvidenceOut[] = []
  for (const e of candidates) {
    const u = byIdx.get(e.utterance_index)
    if (!u || !quoteInText(e.quote, u.text)) {
      droppedUnverified++
      continue
    }
    if (roleOf(u.speaker_label) !== "rep") {
      droppedNotRep++
      continue
    }
    // a voice claim needs a measured flag on that very line
    const flags = voiceOn ? (scenario.voice!.lines[u.idx]?.flags ?? []) : []
    let basis = e.basis ?? "words"
    if (basis !== "words" && flags.length === 0) {
      if (basis === "voice") {
        droppedVoice++
        continue
      }
      basis = "words"
      downgradedVoice++
    }
    evidence.push({
      id: nextId(),
      utterance_id: u.id,
      quote: e.quote,
      start_ms: u.start_ms,
      criterion: e.criterion,
      severity: e.severity,
      explanation: e.explanation,
      basis,
      voice_cues: flags.map((f) => f.label.toLowerCase()),
    })
  }
  if (voiceOn && droppedVoice) warnings.push(`${droppedVoice} voice-based claim(s) had no measured voice signal behind them and were removed.`)
  if (voiceOn && downgradedVoice) warnings.push(`${downgradedVoice} evidence item(s) claimed a vocal quality that was not measured; they now rest on the words only.`)
  if (droppedUnverified) {
    warnings.push(`${droppedUnverified} tone quote(s) could not be found in the transcript and were removed.`)
  }
  if (droppedNotRep) {
    warnings.push(`${droppedNotRep} tone quote(s) were from the customer, not the rep, and were ignored.`)
  }

  // 2. verdict
  let tone: "RED" | "GREEN"
  let toneConfidence: number | null
  let explanation: string

  if (!rep) {
    tone = "GREEN"
    toneConfidence = null
    needsReview = true
    evidence.length = 0
    explanation =
      "Tone could not be assessed because the sales representative could not be identified. " +
      "Assign the rep in the speaker settings, then re-analyse."
    warnings.push("No speaker was identified as the sales rep.")
  } else {
    const conf = modelNegative
      ? clamp01(raw.confidence + SENSITIVITY_DELTA[settings.tone_sensitivity])
      : raw.negative
        ? 0.85 // model saw problems, but none under the enabled criteria
        : raw.confidence
    toneConfidence = conf
    explanation = modelNegative
      ? raw.explanation
      : raw.negative
        ? "Nothing in the rep's speech matched the tone criteria that are switched on."
        : raw.explanation

    // voice-only evidence counts toward RED only in "strong" mode
    const counting = evidence.filter((ev) => ev.basis !== "voice" || settings.voice_mode === "strong")
    if (modelNegative && counting.length > 0 && conf >= settings.red_confidence_threshold) {
      tone = "RED"
    } else {
      tone = "GREEN"
      if (modelNegative && evidence.length > 0 && counting.length === 0) {
        needsReview = true
        warnings.push(
          "Only the rep's voice suggested a negative tone, not the words. Set voice analysis to 'Strong' if voice alone should be enough for RED. Review this call.",
        )
      } else if (modelNegative && evidence.length > 0) {
        needsReview = true
        warnings.push(
          `Possible negative tone, but confidence (${pct(conf)}) is below your RED threshold (${pct(settings.red_confidence_threshold)}).`,
        )
      } else if (modelNegative) {
        needsReview = true
        warnings.push(
          "The model suspected negative tone but no quote from the rep could be verified, so it was not flagged RED.",
        )
      }
    }
    if (conf < LOW_CONFIDENCE) needsReview = true
    if (repConfidence !== null && repConfidence < LOW_CONFIDENCE) {
      needsReview = true
      warnings.push("Rep/customer roles were inferred with low confidence. Check them and swap if needed.")
    }
  }

  // 3. action items
  const items: Omit<ActionItemOut, "id">[] = []
  let droppedItems = 0
  for (const p of scenario.pool) {
    if (!settings.action_item_types.includes(p.item_type)) continue
    const u = byIdx.get(p.utterance_index)
    if (!u || !quoteInText(p.quote, u.text)) {
      droppedItems++
      continue
    }
    const speakerRole = roleOf(u.speaker_label)
    const owner = p.ownerUnclear ? null : speakerRole === "rep" || speakerRole === "customer" ? speakerRole : null
    if (owner === "customer" && !settings.include_customer_actions) continue
    if (p.loose && settings.action_item_specificity === "concrete_only") continue
    items.push({
      utterance_id: u.id,
      description: p.description,
      item_type: p.item_type,
      owner_role: owner,
      deadline_text: p.deadline_text,
      quote: p.quote,
      start_ms: u.start_ms,
      confidence: p.confidence,
    })
  }
  if (droppedItems) {
    warnings.push(`${droppedItems} action item(s) had no verifiable supporting quote and were removed.`)
  }
  items.sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0))

  return {
    id: nextId(),
    version: input.version,
    status: "completed",
    llm_model: settings.llm_model,
    settings_snapshot: {
      ...structuredClone(settings),
      roles_used: Object.fromEntries(speakers.map((sp) => [sp.label, sp.role])),
    },
    tone,
    tone_confidence: toneConfidence,
    needs_review: needsReview,
    tone_explanation: explanation,
    call_summary: scenario.summary,
    warnings,
    error_message: null,
    created_at: input.createdAt,
    completed_at: input.completedAt,
    tone_evidence: evidence,
    action_items: items.map((i) => ({ ...i, id: nextId() })),
  }
}

/** A failed run, as the backend records it (no tone, no evidence, an error message). */
export function failedAnalysis(
  version: number,
  settings: AnalysisSettings,
  message: string,
  at: string,
): AnalysisOut {
  return {
    id: nextId(),
    version,
    status: "failed",
    llm_model: settings.llm_model,
    settings_snapshot: structuredClone(settings),
    tone: null,
    tone_confidence: null,
    needs_review: false,
    tone_explanation: null,
    call_summary: null,
    warnings: [],
    error_message: message,
    created_at: at,
    completed_at: at,
    tone_evidence: [],
    action_items: [],
  }
}
