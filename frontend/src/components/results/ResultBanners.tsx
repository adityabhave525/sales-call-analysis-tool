import { LoaderCircle } from "lucide-react"

import { Notice } from "@/components/common/Notice"
import { Button } from "@/components/ui/button"

const CHANGE_PREVIEW = 4

/** The old result stays visible, dimmed, while a new one is computed. */
export function ReanalysingBanner() {
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
      <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      <p>
        <span className="font-medium">Re-analysing…</span> The previous result stays here until the new one is ready.
      </p>
    </div>
  )
}

/** Backend keeps the old good result and records the error; so do we. */
export function ReanalysisFailedNotice({ message, onRetry, pending }: { message: string; onRetry: () => void; pending: boolean }) {
  return (
    <Notice
      title="The last re-analysis failed"
      action={
        <Button variant="outline" size="sm" onClick={onRetry} disabled={pending}>
          {pending ? "Retrying…" : "Try again"}
        </Button>
      }
    >
      {message} You're still seeing the previous result.
    </Notice>
  )
}

interface OldVersionBannerProps {
  version: number
  latest: number
  onBackToLatest: () => void
  onLoadSettings: () => void
}

export function OldVersionBanner({ version, latest, onBackToLatest, onLoadSettings }: OldVersionBannerProps) {
  return (
    <Notice variant="info" title={`You're viewing version ${version}, not the latest`}>
      <p>
        This is an earlier analysis of the same call. Speaker roles in the transcript are the current ones, which may differ from
        what that version used.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={onBackToLatest}>
          Back to latest (v{latest})
        </Button>
        <Button size="sm" variant="outline" onClick={onLoadSettings}>
          Load this version's settings
        </Button>
      </div>
    </Notice>
  )
}

interface StaleBannerProps {
  changes: readonly string[]
  rolesChanged: boolean
  blockedReason: string | null
  pending: boolean
  onReanalyse: () => void
  onEditSettings: () => void
}

/** Shown when the settings or speaker roles no longer match the analysis on screen. */
export function StaleBanner({ changes, rolesChanged, blockedReason, pending, onReanalyse, onEditSettings }: StaleBannerProps) {
  const shown = changes.slice(0, CHANGE_PREVIEW)
  const hidden = changes.length - shown.length
  const what = rolesChanged && changes.length > 0 ? "Settings and speaker roles have" : rolesChanged ? "Speaker roles have" : "Your settings have"

  return (
    <Notice variant="info" title={`${what} changed since this analysis`}>
      <ul className="list-disc space-y-0.5 pl-4">
        {rolesChanged && <li>Who the sales rep is was changed, so tone and action item owners may be out of date</li>}
        {shown.map((c) => (
          <li key={c}>{c}</li>
        ))}
        {hidden > 0 && <li>…and {hidden} more</li>}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onReanalyse} disabled={pending || blockedReason !== null}>
          {pending ? "Starting…" : "Re-analyse with these"}
        </Button>
        <Button size="sm" variant="outline" onClick={onEditSettings}>
          Edit settings
        </Button>
        {blockedReason && <span className="text-xs text-amber-800">{blockedReason}</span>}
      </div>
    </Notice>
  )
}
