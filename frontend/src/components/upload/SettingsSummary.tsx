import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MODEL_OPTIONS, SENSITIVITY_OPTIONS } from "@/lib/settings"
import { useSettingsStore } from "@/store/settingsStore"
import { useUiStore } from "@/store/uiStore"

/** Read-only recap of the settings the next analysis will use, with a way to change them. */
export function SettingsSummary({ showEdit = true }: { showEdit?: boolean }) {
  const settings = useSettingsStore((s) => s.settings)
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen)

  const sensitivity = SENSITIVITY_OPTIONS.find((o) => o.value === settings.tone_sensitivity)?.label
  const model = MODEL_OPTIONS.find((m) => m.value === settings.llm_model)?.label ?? settings.llm_model
  const criteriaOn = settings.tone_criteria.filter((c) => c.enabled).length

  const chips = [
    `${sensitivity} sensitivity`,
    `RED at ${Math.round(settings.red_confidence_threshold * 100)}%+ confidence`,
    `${criteriaOn} of ${settings.tone_criteria.length} tone criteria`,
    `${settings.action_item_types.length} action item types`,
    model,
    ...(settings.custom_instructions.trim() ? ["Custom instructions"] : []),
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Analysis settings</p>
        {showEdit && (
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setSettingsOpen(true)}>
            Edit settings
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <Badge key={chip} variant="secondary" className="font-normal">
            {chip}
          </Badge>
        ))}
      </div>
    </div>
  )
}
