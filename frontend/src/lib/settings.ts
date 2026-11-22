/**
 * Settings logic: defaults, validation, and pure update functions.
 * The Zustand store (src/store/settingsStore.ts) is a thin wrapper around these,
 * which keeps every rule easy to test and reuse.
 *
 * DEFAULTS MUST MIRROR backend/app/schemas.py (AnalysisSettings). The backend
 * also exposes GET /api/settings/defaults; once we connect, "Reset" can use that.
 */
import type {
  ActionSpecificity,
  ActionType,
  AnalysisSettings,
  LlmModel,
  ToneCriterion,
  ToneSensitivity,
} from "@/types/api"

// ---------- Limits (enforced here and by the backend) ----------
export const LIMITS = {
  thresholdMin: 0.3,
  thresholdMax: 0.95,
  thresholdStep: 0.05,
  customInstructionsMax: 1000,
  criterionLabelMax: 40,
  criterionDefinitionMax: 300,
  maxCustomCriteria: 6,
} as const

// ---------- Built-in criteria (mirror of schemas.default_criteria) ----------
const BUILT_IN_CRITERIA: readonly ToneCriterion[] = [
  {
    key: "rudeness",
    label: "Rudeness",
    enabled: true,
    definition: "Insults, sarcasm, mocking, or disrespectful language toward the customer.",
  },
  {
    key: "hostility",
    label: "Hostility",
    enabled: true,
    definition: "Aggression, threats, or blaming the customer.",
  },
  {
    key: "dismissiveness",
    label: "Dismissiveness",
    enabled: true,
    definition: "Brushing off concerns, ignoring questions, or minimising the customer's problem.",
  },
  {
    key: "impatience",
    label: "Impatience",
    enabled: false,
    definition: "Rushing the customer, cutting them off, or showing irritation at questions.",
  },
]

const BUILT_IN_KEYS: ReadonlySet<string> = new Set(BUILT_IN_CRITERIA.map((c) => c.key))

export function isBuiltInCriterion(key: string): boolean {
  return BUILT_IN_KEYS.has(key)
}

export const ALL_ACTION_TYPES: readonly ActionType[] = [
  "commitment",
  "follow_up",
  "send_information",
  "schedule_meeting",
]

export function createDefaultSettings(): AnalysisSettings {
  return {
    llm_model: "claude-haiku-5-5",
    tone_sensitivity: "balanced",
    red_confidence_threshold: 0.6,
    tone_criteria: BUILT_IN_CRITERIA.map((c) => ({ ...c })),
    action_item_types: [...ALL_ACTION_TYPES],
    include_customer_actions: true,
    action_item_specificity: "concrete_only",
    custom_instructions: "",
  }
}

// ---------- Labels/descriptions the settings UI renders ----------
export const SENSITIVITY_OPTIONS: readonly {
  value: ToneSensitivity
  label: string
  description: string
}[] = [
  { value: "lenient", label: "Lenient", description: "Only clear rudeness or hostility is flagged." },
  { value: "balanced", label: "Balanced", description: "Flags what a sales manager would call unprofessional." },
  { value: "strict", label: "Strict", description: "Also flags subtle condescension, impatience and brush-offs." },
]

export const ACTION_TYPE_OPTIONS: readonly {
  value: ActionType
  label: string
  description: string
}[] = [
  { value: "commitment", label: "Commitments", description: "Firm promises to do something." },
  { value: "follow_up", label: "Follow-ups", description: "Agreed check-ins or next contact." },
  { value: "send_information", label: "Information to send", description: "Documents, quotes or links promised." },
  { value: "schedule_meeting", label: "Meetings", description: "Demos or appointments agreed." },
]

export const SPECIFICITY_OPTIONS: readonly {
  value: ActionSpecificity
  label: string
  description: string
}[] = [
  { value: "concrete_only", label: "Concrete only", description: "Skips vague lines like “I'll keep you posted”." },
  { value: "any", label: "Include loose follow-ups", description: "Also keeps loosely stated follow-ups." },
]

export const MODEL_OPTIONS: readonly { value: LlmModel; label: string; description: string }[] = [
  { value: "claude-haiku-5-5", label: "Claude Haiku 5.5", description: "Fast and very low cost. Good default." },
  {
    value: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    description: "More nuanced on borderline tone. Costs roughly 10-20x more per call.",
  },
]

// ---------- Helpers ----------
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

export function clampThreshold(v: number): number {
  if (!Number.isFinite(v)) return 0.6
  const snapped = Math.round(v / LIMITS.thresholdStep) * LIMITS.thresholdStep
  const clamped = Math.min(LIMITS.thresholdMax, Math.max(LIMITS.thresholdMin, snapped))
  return Number(clamped.toFixed(2))
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

// ---------- Sanitising untrusted input (localStorage, old snapshots) ----------
function sanitizeCriteria(input: unknown): ToneCriterion[] {
  const defaults = createDefaultSettings().tone_criteria
  if (!Array.isArray(input)) return defaults

  const seen = new Set<string>()
  const parsed: ToneCriterion[] = []
  for (const raw of input) {
    if (!isRecord(raw)) continue
    const key = typeof raw.key === "string" ? raw.key : ""
    if (!/^[a-z0-9_]{1,50}$/.test(key) || seen.has(key)) continue
    seen.add(key)
    const builtIn = BUILT_IN_CRITERIA.find((c) => c.key === key)
    parsed.push({
      key,
      // built-in labels are fixed
      label: builtIn
        ? builtIn.label
        : (typeof raw.label === "string" ? raw.label : key).slice(0, LIMITS.criterionLabelMax),
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : (builtIn?.enabled ?? true),
      definition:
        typeof raw.definition === "string"
          ? raw.definition.slice(0, LIMITS.criterionDefinitionMax)
          : (builtIn?.definition ?? ""),
    })
  }

  // built-ins always present, in canonical order; customs follow
  const builtIns = defaults.map((d) => parsed.find((p) => p.key === d.key) ?? d)
  const customs = parsed.filter((p) => !isBuiltInCriterion(p.key)).slice(0, LIMITS.maxCustomCriteria)
  return [...builtIns, ...customs]
}

/** Turn anything (corrupted localStorage, an old backend snapshot) into valid settings. */
export function sanitizeSettings(input: unknown): AnalysisSettings {
  const d = createDefaultSettings()
  if (!isRecord(input)) return d

  const types = Array.isArray(input.action_item_types)
    ? ALL_ACTION_TYPES.filter((t) => (input.action_item_types as unknown[]).includes(t))
    : [...d.action_item_types]

  return {
    llm_model: pick(input.llm_model, MODEL_OPTIONS.map((m) => m.value), d.llm_model),
    tone_sensitivity: pick(input.tone_sensitivity, SENSITIVITY_OPTIONS.map((o) => o.value), d.tone_sensitivity),
    red_confidence_threshold:
      typeof input.red_confidence_threshold === "number"
        ? clampThreshold(input.red_confidence_threshold)
        : d.red_confidence_threshold,
    tone_criteria: sanitizeCriteria(input.tone_criteria),
    action_item_types: types.length > 0 ? types : [...d.action_item_types],
    include_customer_actions:
      typeof input.include_customer_actions === "boolean"
        ? input.include_customer_actions
        : d.include_customer_actions,
    action_item_specificity: pick(
      input.action_item_specificity,
      SPECIFICITY_OPTIONS.map((o) => o.value),
      d.action_item_specificity,
    ),
    custom_instructions:
      typeof input.custom_instructions === "string"
        ? input.custom_instructions.slice(0, LIMITS.customInstructionsMax)
        : "",
  }
}

/** True if two settings objects mean the same thing (key order and old snapshots don't matter). */
export function settingsEqual(a: unknown, b: unknown): boolean {
  return stableStringify(sanitizeSettings(a)) === stableStringify(sanitizeSettings(b))
}

// ---------- Validation ----------
/** Problems that should block "Analyse" / "Re-analyse". */
export function getSettingsIssues(s: AnalysisSettings): string[] {
  const issues: string[] = []
  for (const c of s.tone_criteria) {
    if (c.enabled && c.definition.trim() === "") {
      issues.push(`“${c.label}” is enabled but has no definition.`)
    }
  }
  if (s.action_item_types.length === 0) issues.push("Select at least one action item type.")
  return issues
}

/** Not blocking, but worth a notice: with nothing enabled every call comes back GREEN. */
export function hasEnabledCriteria(s: AnalysisSettings): boolean {
  return s.tone_criteria.some((c) => c.enabled)
}

/** What we actually send to the backend: trimmed, nothing extra. */
export function toRequestSettings(s: AnalysisSettings): AnalysisSettings {
  return {
    ...s,
    tone_criteria: s.tone_criteria.map((c) => ({
      ...c,
      label: c.label.trim(),
      definition: c.definition.trim(),
    })),
    custom_instructions: s.custom_instructions.trim(),
  }
}

// ---------- Pure updates (used by the store) ----------
export function withRedThreshold(s: AnalysisSettings, value: number): AnalysisSettings {
  return { ...s, red_confidence_threshold: clampThreshold(value) }
}

export function withCustomInstructions(s: AnalysisSettings, text: string): AnalysisSettings {
  return { ...s, custom_instructions: text.slice(0, LIMITS.customInstructionsMax) }
}

/** Never lets the last action type be removed. */
export function withToggledActionType(s: AnalysisSettings, type: ActionType): AnalysisSettings {
  const has = s.action_item_types.includes(type)
  if (has && s.action_item_types.length === 1) return s
  const next = has
    ? s.action_item_types.filter((t) => t !== type)
    : ALL_ACTION_TYPES.filter((t) => t === type || s.action_item_types.includes(t))
  return { ...s, action_item_types: next }
}

export type CriterionPatch = Partial<Pick<ToneCriterion, "enabled" | "definition" | "label">>

export function withCriterionPatch(
  s: AnalysisSettings,
  key: string,
  patch: CriterionPatch,
): AnalysisSettings {
  return {
    ...s,
    tone_criteria: s.tone_criteria.map((c) => {
      if (c.key !== key) return c
      return {
        ...c,
        enabled: patch.enabled ?? c.enabled,
        definition:
          patch.definition !== undefined
            ? patch.definition.slice(0, LIMITS.criterionDefinitionMax)
            : c.definition,
        // only custom criteria can be renamed
        label:
          patch.label !== undefined && !isBuiltInCriterion(key)
            ? patch.label.slice(0, LIMITS.criterionLabelMax)
            : c.label,
      }
    }),
  }
}

export type AddCriterionResult = { settings: AnalysisSettings } | { error: string }

export function withNewCriterion(
  s: AnalysisSettings,
  label: string,
  definition: string,
): AddCriterionResult {
  const name = label.trim()
  const def = definition.trim()
  if (!name) return { error: "Give the criterion a name." }
  if (!def) return { error: "Describe what this criterion looks for." }
  const customCount = s.tone_criteria.filter((c) => !isBuiltInCriterion(c.key)).length
  if (customCount >= LIMITS.maxCustomCriteria) {
    return { error: `You can add up to ${LIMITS.maxCustomCriteria} custom criteria.` }
  }

  const base = `custom_${slugify(name) || "criterion"}`
  const taken = new Set(s.tone_criteria.map((c) => c.key))
  let key = base
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`

  const criterion: ToneCriterion = {
    key,
    label: name.slice(0, LIMITS.criterionLabelMax),
    enabled: true,
    definition: def.slice(0, LIMITS.criterionDefinitionMax),
  }
  return { settings: { ...s, tone_criteria: [...s.tone_criteria, criterion] } }
}

/** Built-in criteria can be disabled but not removed. */
export function withoutCriterion(s: AnalysisSettings, key: string): AnalysisSettings {
  if (isBuiltInCriterion(key)) return s
  return { ...s, tone_criteria: s.tone_criteria.filter((c) => c.key !== key) }
}
