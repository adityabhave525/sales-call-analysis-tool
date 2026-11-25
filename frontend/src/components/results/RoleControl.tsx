import { ArrowLeftRight } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAssignRep, useReanalyse } from "@/hooks/useJobs"
import { describeError } from "@/lib/errors"
import { getRequestSettings } from "@/store/settingsStore"
import type { SpeakerOut } from "@/types/api"

interface RoleControlProps {
  jobId: string
  speakers: readonly SpeakerOut[]
  disabled?: boolean
}

/**
 * Who is the sales rep? The app guesses; this lets the user correct it.
 * Changing it affects the NEXT analysis, so we offer to re-analyse right away.
 */
export function RoleControl({ jobId, speakers, disabled = false }: RoleControlProps) {
  const assign = useAssignRep()
  const reanalyse = useReanalyse()
  const rep = speakers.find((s) => s.role === "rep")

  if (speakers.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Only one speaker was detected, so the rep can't be told apart from the customer.
      </p>
    )
  }

  const swapTarget = speakers.length === 2 ? speakers.find((s) => s.label !== rep?.label) : undefined
  const busy = disabled || assign.isPending || reanalyse.isPending

  function choose(label: string) {
    if (label === rep?.label) return
    assign.mutate(
      { id: jobId, repLabel: label },
      {
        onSuccess: () =>
          toast.success(`Speaker ${label} is now the sales rep`, {
            description: "Re-analyse so the tone check and action item owners use this.",
            action: {
              label: "Re-analyse now",
              onClick: () =>
                reanalyse.mutate(
                  { id: jobId, settings: getRequestSettings() },
                  { onError: (e) => toast.error(describeError(e)) },
                ),
            },
          }),
        onError: (e) => toast.error(describeError(e)),
      },
    )
  }

  const provenance = !rep
    ? "Not identified yet. Choose who the rep is."
    : rep.role_source === "user"
      ? "Set by you"
      : "Auto-detected"

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Sales rep is</span>
        <Select value={rep?.label ?? ""} onValueChange={choose} disabled={busy}>
          <SelectTrigger className="h-8 w-36" aria-label="Who is the sales rep?">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {speakers.map((s) => (
              <SelectItem key={s.label} value={s.label}>
                Speaker {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {swapTarget && (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => choose(swapTarget.label)}>
            <ArrowLeftRight />
            Swap roles
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{provenance}</p>
    </div>
  )
}
