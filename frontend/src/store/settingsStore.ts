import { useMemo } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import {
  createDefaultSettings,
  getSettingsIssues,
  sanitizeSettings,
  toRequestSettings,
  withCriterionPatch,
  withCustomInstructions,
  withNewCriterion,
  withoutCriterion,
  withToggledActionType,
  type CriterionPatch,
} from "@/lib/settings"
import type {
  ActionSpecificity,
  ActionType,
  AnalysisSettings,
  LlmModel,
  ToneSensitivity,
  VoiceMode,
} from "@/types/api"

interface SettingsState {
  settings: AnalysisSettings

  setLlmModel: (model: LlmModel) => void
  setToneSensitivity: (value: ToneSensitivity) => void
  setVoiceMode: (value: VoiceMode) => void
  updateCriterion: (key: string, patch: CriterionPatch) => void
  /** Returns an error message to show in the UI, or null on success. */
  addCriterion: (label: string, definition: string) => string | null
  removeCriterion: (key: string) => void
  toggleActionType: (type: ActionType) => void
  setIncludeCustomerActions: (value: boolean) => void
  setActionSpecificity: (value: ActionSpecificity) => void
  setCustomInstructions: (text: string) => void
  /** Replace everything, e.g. "use the settings from that older analysis". Sanitised. */
  loadSettings: (settings: unknown) => void
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => {
      const update = (fn: (s: AnalysisSettings) => AnalysisSettings) =>
        set((state) => ({ settings: fn(state.settings) }))

      return {
        settings: createDefaultSettings(),

        setLlmModel: (llm_model) => update((s) => ({ ...s, llm_model })),
        setToneSensitivity: (tone_sensitivity) => update((s) => ({ ...s, tone_sensitivity })),
        setVoiceMode: (voice_mode) => update((s) => ({ ...s, voice_mode })),
        updateCriterion: (key, patch) => update((s) => withCriterionPatch(s, key, patch)),
        addCriterion: (label, definition) => {
          const result = withNewCriterion(get().settings, label, definition)
          if ("error" in result) return result.error
          set({ settings: result.settings })
          return null
        },
        removeCriterion: (key) => update((s) => withoutCriterion(s, key)),
        toggleActionType: (type) => update((s) => withToggledActionType(s, type)),
        setIncludeCustomerActions: (include_customer_actions) =>
          update((s) => ({ ...s, include_customer_actions })),
        setActionSpecificity: (action_item_specificity) =>
          update((s) => ({ ...s, action_item_specificity })),
        setCustomInstructions: (text) => update((s) => withCustomInstructions(s, text)),
        loadSettings: (settings) => set({ settings: sanitizeSettings(settings) }),
        resetToDefaults: () => set({ settings: createDefaultSettings() }),
      }
    },
    {
      name: "call-analyzer:settings",
      version: 1,
      // persist only data, never the action functions
      partialize: (state) => ({ settings: state.settings }),
      // localStorage can be stale or hand-edited: always sanitise on load
      merge: (persisted, current) => ({
        ...current,
        settings: sanitizeSettings((persisted as { settings?: unknown } | undefined)?.settings),
      }),
    },
  ),
)

// ---------- Convenience hooks / helpers ----------

/**
 * Blocking problems with the current settings (empty array = OK).
 * Memoised because Zustand v5 selectors must not return a new array each render.
 */
export function useSettingsIssues(): string[] {
  const settings = useSettingsStore((s) => s.settings)
  return useMemo(() => getSettingsIssues(settings), [settings])
}

/** Trimmed settings ready to send to the backend, for use inside React components. */
export function useRequestSettings(): AnalysisSettings {
  const settings = useSettingsStore((s) => s.settings)
  return useMemo(() => toRequestSettings(settings), [settings])
}

/** Same thing outside React (e.g. inside a mutation function). */
export function getRequestSettings(): AnalysisSettings {
  return toRequestSettings(useSettingsStore.getState().settings)
}
