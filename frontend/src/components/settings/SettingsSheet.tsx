import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useUiStore } from "@/store/uiStore"
import { SettingsFooter } from "./SettingsFooter"
import { ActionSettings } from "./sections/ActionSettings"
import { AdvancedSettings } from "./sections/AdvancedSettings"
import { ToneSettings } from "./sections/ToneSettings"

export function SettingsSheet() {
  const open = useUiStore((s) => s.settingsOpen)
  const setOpen = useUiStore((s) => s.setSettingsOpen)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Analysis settings</SheetTitle>
          <SheetDescription>
            Control how tone is judged and which action items are extracted. Existing results don't change until you re-analyse.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6">
          <ToneSettings />
          <Separator />
          <ActionSettings />
          <Separator />
          <AdvancedSettings />
        </div>

        <SettingsFooter onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
