import { useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import { api } from "@/api"
import { useReanalyse } from "@/hooks/useJobs"
import { useTranscriptInteraction } from "@/hooks/useTranscriptInteraction"
import { describeError } from "@/lib/errors"
import { buildMarkers } from "@/lib/results"
import { describeSettingsChanges, rolesDiffer } from "@/lib/settingsDiff"
import { latestCompletedVersion } from "@/lib/versions"
import { cn } from "@/lib/utils"
import { getRequestSettings, useSettingsIssues, useSettingsStore } from "@/store/settingsStore"
import { useUiStore } from "@/store/uiStore"
import type { AnalysisOut, JobResultOut } from "@/types/api"
import { ActionItemsCard } from "./ActionItemsCard"
import { OldVersionBanner, ReanalysisFailedNotice, ReanalysingBanner, StaleBanner } from "./ResultBanners"
import { ResultHeader } from "./ResultHeader"
import { SummaryCard } from "./SummaryCard"
import { ToneCard } from "./ToneCard"
import { TranscriptPanel } from "./TranscriptPanel"
import { VersionPicker } from "./VersionPicker"

interface ResultsViewProps {
  result: JobResultOut
  analysis: AnalysisOut
  /** a re-analysis is running; the current result stays visible but dimmed */
  reanalysing?: boolean
  /** null = latest */
  onSelectVersion: (version: number | null) => void
}

export function ResultsView({ result, analysis, reanalysing = false, onSelectVersion }: ResultsViewProps) {
  const { job, utterances, speakers, language_code, versions } = result
  const settings = useSettingsStore((s) => s.settings)
  const issues = useSettingsIssues()
  const reanalyse = useReanalyse()

  const latest = latestCompletedVersion(versions) ?? analysis.version
  const isLatest = analysis.version === latest

  const markers = useMemo(() => buildMarkers(analysis), [analysis])
  const interaction = useTranscriptInteraction(utterances)
  const audioSrc = useMemo(() => api.audioUrl(job.id), [job.id])

  const changes = useMemo(() => describeSettingsChanges(settings, analysis.settings_snapshot), [settings, analysis.settings_snapshot])
  const rolesChanged = rolesDiffer(analysis.settings_snapshot.roles_used, speakers)
  const stale = isLatest && !reanalysing && (changes.length > 0 || rolesChanged)

  // tell the user when a new version lands
  const seenLatest = useRef(latest)
  useEffect(() => {
    if (latest > seenLatest.current) {
      const tone = versions.find((v) => v.version === latest)?.tone
      toast.success(`Analysis updated (v${latest})${tone ? `: ${tone}` : ""}`)
    }
    seenLatest.current = latest
  }, [latest, versions])

  function rerun() {
    reanalyse.mutate({ id: job.id, settings: getRequestSettings() }, { onError: (e) => toast.error(describeError(e)) })
  }

  return (
    <div className="space-y-6">
      <ResultHeader
        job={job}
        analysis={analysis}
        languageCode={language_code}
        actions={<VersionPicker versions={versions} current={analysis.version} latest={latest} onChange={onSelectVersion} />}
      />

      {reanalysing && <ReanalysingBanner />}

      {!reanalysing && job.status === "completed" && job.error_message && (
        <ReanalysisFailedNotice message={job.error_message} onRetry={rerun} pending={reanalyse.isPending} />
      )}

      {!isLatest && (
        <OldVersionBanner
          version={analysis.version}
          latest={latest}
          onBackToLatest={() => onSelectVersion(null)}
          onLoadSettings={() => {
            useSettingsStore.getState().loadSettings(analysis.settings_snapshot)
            toast.success("Settings loaded from this version", { description: "Open Settings to review them, then re-analyse." })
          }}
        />
      )}

      {stale && (
        <StaleBanner
          changes={changes}
          rolesChanged={rolesChanged}
          blockedReason={issues.length > 0 ? "Fix your settings first." : null}
          pending={reanalyse.isPending}
          onReanalyse={rerun}
          onEditSettings={() => useUiStore.getState().setSettingsOpen(true)}
        />
      )}

      <div
        className={cn("grid items-start gap-6 transition-opacity lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]", reanalysing && "opacity-60")}
        aria-busy={reanalysing}
      >
        <div className="space-y-6">
          <ToneCard analysis={analysis} onJump={interaction.jumpTo} />
          <ActionItemsCard analysis={analysis} filename={job.original_filename} onJump={interaction.jumpTo} />
          <SummaryCard summary={analysis.call_summary} />
        </div>

        <TranscriptPanel
          jobId={job.id}
          rolesDisabled={reanalysing}
          utterances={utterances}
          speakers={speakers}
          markers={markers}
          audioSrc={audioSrc}
          interaction={interaction}
        />
      </div>
    </div>
  )
}
