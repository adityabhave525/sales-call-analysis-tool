import { useMemo } from "react"
import { AudioLines, SlidersHorizontal } from "lucide-react"
import { Link, Outlet } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { SettingsSheet } from "@/components/settings/SettingsSheet"
import { createDefaultSettings, settingsEqual } from "@/lib/settings"
import { useSettingsStore } from "@/store/settingsStore"
import { useUiStore } from "@/store/uiStore"

export function AppShell() {
  const settings = useSettingsStore((s) => s.settings)
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen)
  const customised = useMemo(() => !settingsEqual(settings, createDefaultSettings()), [settings])

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <AudioLines className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Call Analyzer</span>
          </Link>

          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <SlidersHorizontal />
            Settings
            {customised && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                Customised
              </Badge>
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
        <Outlet />
      </main>

      <SettingsSheet />
      <Toaster position="bottom-right" />
    </div>
  )
}
