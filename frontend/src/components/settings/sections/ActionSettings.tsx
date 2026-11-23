import { Field, Section } from "@/components/settings/Field"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ACTION_TYPE_OPTIONS, SPECIFICITY_OPTIONS } from "@/lib/settings"
import { useSettingsStore } from "@/store/settingsStore"
import type { ActionSpecificity } from "@/types/api"

const store = () => useSettingsStore.getState()

export function ActionSettings() {
  const types = useSettingsStore((s) => s.settings.action_item_types)
  const includeCustomer = useSettingsStore((s) => s.settings.include_customer_actions)
  const specificity = useSettingsStore((s) => s.settings.action_item_specificity)
  const spec = SPECIFICITY_OPTIONS.find((o) => o.value === specificity)

  return (
    <Section title="Action items" description="What counts as an action item. Items are only listed when the transcript backs them up.">
      <Field label="Types to extract" hint="At least one type must stay on.">
        <ul className="space-y-2">
          {ACTION_TYPE_OPTIONS.map((o) => {
            const on = types.includes(o.value)
            const last = on && types.length === 1
            return (
              <li key={o.value} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                <Switch
                  id={`type-${o.value}`}
                  checked={on}
                  disabled={last}
                  onCheckedChange={() => store().toggleActionType(o.value)}
                />
                <label htmlFor={`type-${o.value}`} className="flex-1">
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.description}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </Field>

      <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
        <Switch id="include-customer" checked={includeCustomer} onCheckedChange={(v: boolean) => store().setIncludeCustomerActions(v)} />
        <label htmlFor="include-customer" className="flex-1">
          <span className="block text-sm font-medium">Include the customer's commitments</span>
          <span className="block text-xs text-muted-foreground">e.g. “I'll confirm with my team tomorrow”.</span>
        </label>
      </div>

      <Field label="How strict to be" hint={spec?.description}>
        <ToggleGroup
          type="single"
          variant="outline"
          value={specificity}
          onValueChange={(v: string) => v && store().setActionSpecificity(v as ActionSpecificity)}
          className="w-full"
          aria-label="Action item strictness"
        >
          {SPECIFICITY_OPTIONS.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} className="flex-1">
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
    </Section>
  )
}
