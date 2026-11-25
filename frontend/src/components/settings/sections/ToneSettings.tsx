import { Field, Section } from "@/components/settings/Field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Slider } from "@/components/ui/slider"
import { LIMITS, SENSITIVITY_OPTIONS, VOICE_MODE_OPTIONS } from "@/lib/settings"
import { useSettingsStore } from "@/store/settingsStore"
import type { ToneSensitivity, VoiceMode } from "@/types/api"
import { CriteriaEditor } from "./CriteriaEditor"

export function ToneSettings() {
  const sensitivity = useSettingsStore((s) => s.settings.tone_sensitivity)
  const threshold = useSettingsStore((s) => s.settings.red_confidence_threshold)
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
        label={`RED threshold: ${Math.round(threshold * 100)}%`}
        hint={
          <>
            A call is only marked RED when the model is at least this confident <em>and</em> a quote from the rep backs it up.
            Below it, the call stays GREEN but is flagged “Needs review”. Lower flags more calls; higher flags fewer, surer ones.
          </>
        }
      >
        <Slider
          min={LIMITS.thresholdMin}
          max={LIMITS.thresholdMax}
          step={LIMITS.thresholdStep}
          value={[threshold]}
          onValueChange={(v: number[]) => useSettingsStore.getState().setRedThreshold(v[0])}
          aria-label="RED confidence threshold"
        />
        <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
          <span>{Math.round(LIMITS.thresholdMin * 100)}% (flags more)</span>
          <span>{Math.round(LIMITS.thresholdMax * 100)}% (flags fewer)</span>
        </div>
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
