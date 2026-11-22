import { toast } from "sonner"

import { Notice } from "@/components/common/Notice"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SettingsSummary } from "@/components/upload/SettingsSummary"
import { useSettingsStore } from "@/store/settingsStore"
import { useUiStore } from "@/store/uiStore"

/** STUB: opens and closes, shows the current settings read-only. The editing controls are the next step. */
export function SettingsSheet() {
  const open = useUiStore((s) => s.settingsOpen)
  const setOpen = useUiStore((s) => s.setSettingsOpen)
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Analysis settings</SheetTitle>
          <SheetDescription>Control how tone is judged and which action items are extracted.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <SettingsSummary showEdit={false} />
          <Notice variant="info" title="Editing controls come next">
            Sensitivity, tone criteria, action item rules and custom instructions will be editable here.
          </Notice>
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetToDefaults()
              toast.success("Settings reset to defaults")
            }}
          >
            Reset to defaults
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
