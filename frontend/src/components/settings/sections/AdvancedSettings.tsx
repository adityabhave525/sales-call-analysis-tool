import { Field, Section } from "@/components/settings/Field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { LIMITS, MODEL_OPTIONS } from "@/lib/settings"
import { useSettingsStore } from "@/store/settingsStore"
import type { LlmModel } from "@/types/api"

export function AdvancedSettings() {
  const model = useSettingsStore((s) => s.settings.llm_model)
  const instructions = useSettingsStore((s) => s.settings.custom_instructions)
  const current = MODEL_OPTIONS.find((m) => m.value === model)

  return (
    <>
      <Section title="Your rules" description="Rules you write here take priority over the built-in judgement, in plain language.">
        <Field
          label="Instructions"
          htmlFor="custom-instructions"
          hint="If a rule says something is acceptable, it won't count toward RED even if the AI thinks it's rude. It will still be listed as dismissed. Anything your rules don't mention is judged normally. Every claim must still be backed by a real quote from the rep."
        >
          <Textarea
            id="custom-instructions"
            rows={4}
            value={instructions}
            maxLength={LIMITS.customInstructionsMax}
            placeholder="e.g. Blunt, curt replies are fine with our long-time clients. Sarcastic banter is OK. A rep mentioning competitors is fine."
            onChange={(e: { target: { value: string } }) => useSettingsStore.getState().setCustomInstructions(e.target.value)}
          />
          <p className="text-right text-xs text-muted-foreground">
            {instructions.length}/{LIMITS.customInstructionsMax}
          </p>
        </Field>
      </Section>

      <Section title="Model">
        <Field label="Analysis model" hint={current?.description}>
          <Select value={model} onValueChange={(v: string) => useSettingsStore.getState().setLlmModel(v as LlmModel)}>
            <SelectTrigger className="w-full" aria-label="Analysis model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>
    </>
  )
}
