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
      <Section title="Custom instructions" description="Extra context for the analysis, in plain language.">
        <Field
          label="Instructions"
          htmlFor="custom-instructions"
          hint="Added to the analysis prompt. They can shape what the model looks for, but can't override the rule that every claim must be backed by a quote."
        >
          <Textarea
            id="custom-instructions"
            rows={4}
            value={instructions}
            maxLength={LIMITS.customInstructionsMax}
            placeholder="e.g. We sell car insurance. A rep mentioning competitors is fine. Ignore small talk about the weather."
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
