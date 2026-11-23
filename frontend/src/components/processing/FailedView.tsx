import { useMemo } from "react"
import { RotateCcw } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"

import { api } from "@/api"
import { Notice } from "@/components/common/Notice"
import { TranscriptPanel } from "@/components/results/TranscriptPanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useReanalyse } from "@/hooks/useJobs"
import { useTranscriptInteraction } from "@/hooks/useTranscriptInteraction"
import { describeError } from "@/lib/errors"
import { failedStepIndex, PIPELINE_STEPS } from "@/lib/jobs"
import { getRequestSettings } from "@/store/settingsStore"
import type { JobOut, JobResultOut } from "@/types/api"
import { StepList } from "./StepList"

const NO_MARKERS = new Map<number, { evidence: boolean; action: boolean }>()
const NO_LINES: JobResultOut["utterances"] = []

interface FailedViewProps {
  job: JobOut
  /** undefined while it is still loading */
  result: JobResultOut | undefined
}

export function FailedView({ job, result }: FailedViewProps) {
  const reanalyse = useReanalyse()
  const utterances = result?.utterances ?? NO_LINES
  const interaction = useTranscriptInteraction(utterances)
  const audioSrc = useMemo(() => api.audioUrl(job.id), [job.id])

  const hasTranscript = utterances.length > 0
  const failedAt = failedStepIndex(job.failed_stage, hasTranscript)

  function retry() {
    reanalyse.mutate(
      { id: job.id, settings: getRequestSettings() },
      { onError: (e) => toast.error(describeError(e)) },
    )
  }

  return (
    <div className="space-y-6">
      <Card className="mx-auto w-full max-w-xl">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <header className="space-y-1">
            <p className="text-sm text-muted-foreground">This analysis didn't finish</p>
            <h1 className="truncate text-xl font-semibold" title={job.original_filename}>
              {job.original_filename}
            </h1>
          </header>

          <StepList activeIndex={failedAt} failedIndex={failedAt} />

          <Notice title={`Stopped at: ${PIPELINE_STEPS[failedAt].title}`}>
            {job.error_message ?? "Something went wrong, but the server didn't say what."}
          </Notice>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {hasTranscript && (
                <Button onClick={retry} disabled={reanalyse.isPending}>
                  <RotateCcw className={reanalyse.isPending ? "animate-spin" : undefined} />
                  {reanalyse.isPending ? "Retrying…" : "Retry analysis"}
                </Button>
              )}
              <Button asChild variant={hasTranscript ? "outline" : "default"}>
                <Link to="/">{hasTranscript ? "Back to all analyses" : "Upload the recording again"}</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {result === undefined
                ? "Checking what can be recovered…"
                : hasTranscript
                  ? "The transcript was saved, so retrying only repeats the analysis step. It doesn't re-transcribe, so it costs almost nothing."
                  : "No transcript was saved, so the recording has to be uploaded again."}
            </p>
          </div>
        </CardContent>
      </Card>

      {hasTranscript && result && (
        <div className="mx-auto w-full max-w-3xl">
          <TranscriptPanel
            jobId={job.id}
            rolesDisabled={reanalyse.isPending}
            title="Transcript (analysis not completed)"
            utterances={utterances}
            speakers={result.speakers}
            markers={NO_MARKERS}
            audioSrc={audioSrc}
            interaction={interaction}
          />
        </div>
      )}
    </div>
  )
}
