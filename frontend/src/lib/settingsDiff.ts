/** Human-readable differences between two settings objects, and role comparison. Pure. */
import {
  ACTION_TYPE_OPTIONS,
  MODEL_OPTIONS,
  SENSITIVITY_OPTIONS,
  SPECIFICITY_OPTIONS,
  sanitizeSettings,
} from "@/lib/settings"
import type { Role, SpeakerOut } from "@/types/api"

const labelOf = (opts: readonly { value: string; label: string }[], v: string) =>
  opts.find((o) => o.value === v)?.label ?? v
const pct = (x: number) => `${Math.round(x * 100)}%`
const onOff = (b: boolean) => (b ? "on" : "off")

/**
 * What changed going from `used` (the settings an analysis ran with) to `current`.
 * Both sides are sanitised first, so old snapshots and key order never cause false differences.
 * Empty array => the same settings.
 */
export function describeSettingsChanges(current: unknown, used: unknown): string[] {
  const a = sanitizeSettings(current)
  const b = sanitizeSettings(used)
  const out: string[] = []

  if (a.llm_model !== b.llm_model) {
    out.push(`Model: ${labelOf(MODEL_OPTIONS, b.llm_model)} → ${labelOf(MODEL_OPTIONS, a.llm_model)}`)
  }
  if (a.tone_sensitivity !== b.tone_sensitivity) {
    out.push(`Sensitivity: ${labelOf(SENSITIVITY_OPTIONS, b.tone_sensitivity)} → ${labelOf(SENSITIVITY_OPTIONS, a.tone_sensitivity)}`)
  }
  if (a.red_confidence_threshold !== b.red_confidence_threshold) {
    out.push(`RED threshold: ${pct(b.red_confidence_threshold)} → ${pct(a.red_confidence_threshold)}`)
  }

  const before = new Map(b.tone_criteria.map((c) => [c.key, c]))
  const after = new Map(a.tone_criteria.map((c) => [c.key, c]))
  for (const [key, c] of after) {
    const old = before.get(key)
    if (!old) {
      out.push(`Added tone criterion “${c.label}”`)
      continue
    }
    if (old.enabled !== c.enabled) out.push(`${c.label}: ${onOff(old.enabled)} → ${onOff(c.enabled)}`)
    if ((old.enabled || c.enabled) && old.definition.trim() !== c.definition.trim()) {
      out.push(`${c.label}: definition edited`)
    }
  }
  for (const [key, c] of before) if (!after.has(key)) out.push(`Removed tone criterion “${c.label}”`)

  const added = a.action_item_types.filter((t) => !b.action_item_types.includes(t))
  const removed = b.action_item_types.filter((t) => !a.action_item_types.includes(t))
  if (added.length || removed.length) {
    const parts = [
      added.length ? `now includes ${added.map((t) => labelOf(ACTION_TYPE_OPTIONS, t)).join(", ")}` : "",
      removed.length ? `no longer includes ${removed.map((t) => labelOf(ACTION_TYPE_OPTIONS, t)).join(", ")}` : "",
    ].filter(Boolean)
    out.push(`Action item types: ${parts.join("; ")}`)
  }
  if (a.include_customer_actions !== b.include_customer_actions) {
    out.push(`Customer commitments: ${b.include_customer_actions ? "included" : "excluded"} → ${a.include_customer_actions ? "included" : "excluded"}`)
  }
  if (a.action_item_specificity !== b.action_item_specificity) {
    out.push(`Action item detail: ${labelOf(SPECIFICITY_OPTIONS, b.action_item_specificity)} → ${labelOf(SPECIFICITY_OPTIONS, a.action_item_specificity)}`)
  }

  const ai = a.custom_instructions.trim()
  const bi = b.custom_instructions.trim()
  if (ai !== bi) out.push(`Custom instructions: ${!bi ? "added" : !ai ? "removed" : "edited"}`)

  return out
}

/**
 * True when the speakers' roles differ from the ones an analysis used (e.g. after "Swap roles").
 * Analyses recorded before roles_used existed are treated as up to date, since we can't know.
 */
export function rolesDiffer(rolesUsed: Record<string, Role> | undefined, speakers: readonly SpeakerOut[]): boolean {
  if (!rolesUsed) return false
  return speakers.some((s) => (rolesUsed[s.label] ?? "unknown") !== s.role)
}
