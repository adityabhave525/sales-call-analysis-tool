import { History } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDateTime } from "@/lib/format"
import { MODEL_OPTIONS } from "@/lib/settings"
import { cn } from "@/lib/utils"
import type { VersionOut } from "@/types/api"

interface VersionPickerProps {
  versions: readonly VersionOut[]
  current: number
  latest: number
  /** null = go to the latest version */
  onChange: (version: number | null) => void
}

function Dot({ tone, failed }: { tone: VersionOut["tone"]; failed: boolean }) {
  // red/green mean tone, so a failed run gets a neutral ring instead
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        failed ? "border border-muted-foreground/60" : tone === "RED" ? "bg-red-600" : "bg-emerald-600",
      )}
    />
  )
}

export function VersionPicker({ versions, current, latest, onChange }: VersionPickerProps) {
  if (versions.length < 2) return null
  const sorted = [...versions].sort((a, b) => b.version - a.version)

  return (
    <div className="flex items-center gap-2">
      <History className="size-4 text-muted-foreground" aria-hidden="true" />
      <Select value={String(current)} onValueChange={(v: string) => onChange(Number(v) === latest ? null : Number(v))}>
        <SelectTrigger className="h-8 w-[min(22rem,80vw)]" aria-label="Analysis version">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sorted.map((v) => {
            const failed = v.status !== "completed"
            const model = MODEL_OPTIONS.find((m) => m.value === v.llm_model)?.label ?? v.llm_model
            return (
              <SelectItem key={v.version} value={String(v.version)} disabled={failed}>
                <span className="flex items-center gap-2">
                  <Dot tone={v.tone} failed={failed} />
                  <span className="font-medium">v{v.version}</span>
                  <span>{failed ? "failed" : v.tone}</span>
                  <span className="text-muted-foreground">
                    · {model.replace("Claude ", "")} · {formatDateTime(v.created_at)}
                    {v.version === latest && !failed ? " · latest" : ""}
                  </span>
                </span>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
