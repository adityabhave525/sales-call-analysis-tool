import { useMemo } from "react"
import { LoaderCircle, RotateCcw } from "lucide-react"
import { useMatch, useSearchParams } from "react-router"
import { toast } from "sonner"

import { Notice } from "@/components/common/Notice"
import { Button } from "@/components/ui/button"
import { useJob, useReanalyse, useResult } from "@/hooks/useJobs"
import { describeError } from "@/lib/errors"
import { isJobBusy } from "@/lib/jobs"
import { describeSettingsChanges, rolesDiffer } from "@/lib/settingsDiff"
import { getRequestSettings, useSettingsIssues, useSettingsStore } from "@/store/settingsStore"

/**
 * On a call's page: "Re-analyse this call" with the settings above.
 * Elsewhere: just Close. Settings apply to the next upload either way.
 */
export function SettingsFooter({ onClose }: { onClose: () => void }) {
  const match = useMatch("/jobs/:id")
  const id = match?.params.id ?? ""
  const job = useJob(id) // shares the page's polling query; the footer only exists while the drawer is open
  const result = useResult(id, false) // read-only: never fetches by itself
  const reanalyse = useReanalyse()
  const issues = useSettingsIssues()
  const settings = useSettingsStore((s) => s.settings)
  const [params, setParams] = useSearchParams()

  const status = job.data?.status
  const busy = status ? isJobBusy(status) : false
  const hasTranscript = (result.data?.utterances.length ?? 0) > 0
  const canReanalyse = id !== "" && status !== undefined && !busy && (status === "completed" || hasTranscript)

  const analysis = result.data?.analysis ?? null
  const changeCount = useMemo(() => {
    if (!analysis) return 0
    return (
      describeSettingsChanges(settings, analysis.settings_snapshot).length +
      (rolesDiffer(analysis.settings_snapshot.roles_used, result.data?.speakers ?? []) ? 1 : 0)
    )
  }, [analysis, settings, result.data?.speakers])

  function run() {
    reanalyse.mutate(
      { id, settings: getRequestSettings() },
      {
        onSuccess: () => {
          // jump back to the latest version, which is the one about to be created
          if (params.has("v")) {
            const next = new URLSearchParams(params)
            next.delete("v")
            setParams(next)
          }
          toast("Re-analysing with your settings…")
          onClose()
        },
        onError: (e) => toast.error(describeError(e)),
      },
    )
  }

  const blocked = issues.length > 0

  return (
    <div className="space-y-3 border-t bg-background px-6 py-4">
      {blocked && (
        <Notice title="Fix these first">
          <ul className="list-disc space-y-0.5 pl-4">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canReanalyse ? (
          <Button onClick={run} disabled={blocked || reanalyse.isPending} className="flex-1">
            {reanalyse.isPending ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
            {changeCount > 0 ? `Re-analyse this call (${changeCount} change${changeCount === 1 ? "" : "s"})` : "Re-run analysis"}
          </Button>
        ) : (
          <Button onClick={onClose} className="flex-1" disabled={blocked}>
            Done
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            useSettingsStore.getState().resetToDefaults()
            toast.success("Settings reset to defaults")
          }}
        >
          Reset to defaults
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {canReanalyse
          ? "Re-analysing doesn't re-transcribe, so it's quick and costs very little. Your earlier results stay available in the version history."
          : "Changes are saved automatically and apply to your next upload. Open a call to re-analyse it."}
      </p>
    </div>
  )
}
