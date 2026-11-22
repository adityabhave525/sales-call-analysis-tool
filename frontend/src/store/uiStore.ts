import { create } from "zustand"

interface UiState {
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

/** Ephemeral UI state (not persisted). */
export const useUiStore = create<UiState>()((set) => ({
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}))
