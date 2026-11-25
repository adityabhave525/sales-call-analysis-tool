import { Field, Section } from "@/components/settings/Field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { SENSITIVITY_OPTIONS, VOICE_MODE_OPTIONS } from "@/lib/settings"
import { useSettingsStore } from "@/store/settingsStore"
import type { ToneSensitivity, VoiceMode } from "@/types/api"
import { CriteriaEditor } from "./CriteriaEditor"

export function ToneSettings() {
  const sensitivity = useSettingsStore((s) => s.settings.tone_sensitivity)
  const voiceMode = useSettingsStore((s) => s.settings.voice_mode)
  const current = SENSITIVITY_OPTIONS.find((o) => o.value === sensitivity)
  const currentVoice = VOICE_MODE_OPTIONS.find((o) => o.value === voiceMode)

  return (
    <Section
      title="Tone check"
      description="Decides when the sales rep's tone is marked RED. Only the rep is judged, never the customer."
    >
      <Field label="Sensitivity" hint={current?.description}>
        <ToggleGroup
          type="single"
          variant="outline"
          value={sensitivity}
          // clicking the selected item would deselect it; a value is always required
          onValueChange={(v: string) => v && useSettingsStore.getState().setToneSensitivity(v as ToneSensitivity)}
          className="w-full"
          aria-label="Tone sensitivity"
        >
          {SENSITIVITY_OPTIONS.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} className="flex-1">
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field
        label="Voice analysis"
        hint={
          <>
            {currentVoice?.description} Voice is measured from the rep's actual audio, so “That's not my problem” said angrily can be told
            apart from the same words said calmly. Turning it on sends the audio to Behavioral Signals as well as AssemblyAI.
          </>
        }
      >
        <ToggleGroup
          type="single"
          variant="outline"
          value={voiceMode}
          onValueChange={(v: string) => v && useSettingsStore.getState().setVoiceMode(v as VoiceMode)}
          className="w-full"
          aria-label="Voice analysis mode"
        >
          {VOICE_MODE_OPTIONS.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} className="flex-1">
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <CriteriaEditor />
    </Section>
  )
}
