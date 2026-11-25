/** Pure helpers for the results dashboard (labels, markers, lookups). */
import { formatClock } from "@/lib/format"
import type {
  ActionItemOut,
  ActionType,
  AnalysisOut,
  Role,
  Severity,
  Tone,
  UtteranceOut,
} from "@/types/api"

export const LOW_CONFIDENCE = 0.6

export const ACTION_TYPE_LABEL: Record<ActionType, string> = {
  commitment: "Commitment",
  follow_up: "Follow-up",
  send_information: "Send information",
  schedule_meeting: "Meeting",
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Low severity",
  medium: "Medium severity",
  high: "High severity",
}

export function toneHeadline(tone: Tone): string {
  return tone === "RED" ? "Negative tone detected" : "No negative tone detected"
}

export function isLowConfidence(confidence: number | null | undefined): boolean {
  return confidence != null && confidence < LOW_CONFIDENCE
}

export function speakerName(role: Role, label: string): string {
  if (role === "rep") return "Sales rep"
  if (role === "customer") return "Customer"
  return `Speaker ${label}`
}

export function ownerLabel(role: "rep" | "customer" | null): string {
  if (role === "rep") return "Sales rep"
  if (role === "customer") return "Customer"
  return "Owner not specified"
}

export function deadlineLabel(text: string | null): string {
  return text ?? "No deadline stated"
}

function humanize(key: string): string {
  const words = key.replace(/^custom_/, "").replace(/_+/g, " ").trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Other"
}

/** Label for a criterion key, using the settings that were active for THIS analysis. */
export function criterionLabel(analysis: AnalysisOut, key: string | null): string {
  if (!key) return "Other"
  const found = (analysis.settings_snapshot?.tone_criteria ?? []).find((c) => c.key === key)
  return found?.label ?? humanize(key)
}

export function languageName(code: string | null): string | null {
  if (!code) return null
  try {
    return new Intl.DisplayNames(undefined, { type: "language" }).of(code) ?? code
  } catch {
    return code
  }
}

export interface LineMarkers {
  evidence: boolean
  action: boolean
}

/** Which transcript lines carry tone evidence or an action item (keyed by utterance id). */
export function buildMarkers(analysis: AnalysisOut | null): Map<number, LineMarkers> {
  const map = new Map<number, LineMarkers>()
  if (!analysis) return map
  const mark = (id: number | null, kind: keyof LineMarkers) => {
    if (id == null) return
    const cur = map.get(id) ?? { evidence: false, action: false }
    cur[kind] = true
    map.set(id, cur)
  }
  analysis.tone_evidence.filter((e) => !e.dismissed_by_rule).forEach((e) => mark(e.utterance_id, "evidence"))
  analysis.action_items.forEach((a) => mark(a.utterance_id, "action"))
  return map
}

/**
 * The line being spoken at `ms` (binary search; utterances are sorted by time).
 * Returns null before the first line, or once `slackMs` has passed since a line ended.
 */
export function findUtteranceAt(
  utterances: readonly UtteranceOut[],
  ms: number,
  slackMs = 1200,
): UtteranceOut | null {
  let lo = 0
  let hi = utterances.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (utterances[mid].start_ms <= ms) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  if (found < 0) return null
  const u = utterances[found]
  return ms <= u.end_ms + slackMs ? u : null
}

/** Plain-text export of action items, for copying into an email or CRM. */
export function actionItemsToText(items: readonly ActionItemOut[], filename: string): string {
  if (items.length === 0) return `Action items: ${filename}\n\nNone found.`
  const lines = items.map((item, i) => {
    const facts = [ownerLabel(item.owner_role), item.deadline_text ? `due ${item.deadline_text}` : "no deadline stated"]
    const when = item.start_ms != null ? ` [${formatClock(item.start_ms)}]` : ""
    return `${i + 1}. ${item.description} (${facts.join(", ")})\n   "${item.quote}"${when}`
  })
  return `Action items: ${filename}\n\n${lines.join("\n\n")}`
}
