import { Link, useParams, useSearchParams } from "react-router"

import { Notice } from "@/components/common/Notice"
import { FailedView } from "@/components/processing/FailedView"
import { ProcessingView } from "@/components/processing/ProcessingView"
import { ResultsView } from "@/components/results/ResultsView"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useJob, useResult } from "@/hooks/useJobs"
import { describeError } from "@/lib/errors"
import { isJobBusy } from "@/lib/jobs"
import { parseVersionParam } from "@/lib/versions"

function BackButton() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/">Back to start</Link>
    </Button>
  )
}

function ResultsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading results">
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[5fr_7fr]">
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-[28rem] w-full" />
      </div>
    </div>
  )
}

/**
 * One URL, four screens:
 *  - first run in progress      -> processing screen
 *  - re-analysis in progress    -> the previous result, dimmed, with a banner
 *  - completed                  -> results (?v=N shows an older version)
 *  - failed                     -> recovery
 */
export function JobPage() {
  const { id = "" } = useParams()
  const [params, setParams] = useSearchParams()
  const version = parseVersionParam(params.get("v"))

  const job = useJob(id)
  const status = job.data?.status
  const busy = status ? isJobBusy(status) : false
  // Fetched once the job stops changing. While busy this query is disabled but keeps its cached data,
  // which is exactly what lets a re-analysis show the previous result underneath.
  const result = useResult(id, status !== undefined && !busy, version)

  const selectVersion = (v: number | null) => setParams(v === null ? {} : { v: String(v) })

  if (job.isPending) return <ResultsSkeleton />

  if (job.isError) {
    return (
      <Notice title="Couldn't open this analysis" action={<BackButton />}>
        {describeError(job.error)}
      </Notice>
    )
  }

  const j = job.data!

  if (busy) {
    const previous = result.data
    if (previous?.analysis && previous.analysis.status === "completed") {
      return <ResultsView result={previous} analysis={previous.analysis} reanalysing onSelectVersion={selectVersion} />
    }
    // first run, or a retry of a failed job: count from when this stage began, not from the upload
    const startIso = previous && previous.utterances.length > 0 ? j.updated_at : j.created_at
    return <ProcessingView job={j} startIso={startIso} />
  }

  if (j.status === "failed") return <FailedView job={j} result={result.data} />

  // completed
  if (result.isPending) return <ResultsSkeleton />
  if (result.isError) {
    return (
      <Notice
        title="Couldn't load the results"
        action={
          <div className="flex gap-2">
            {version !== undefined && (
              <Button variant="outline" size="sm" onClick={() => selectVersion(null)}>
                Show latest
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => result.refetch()}>
              Try again
            </Button>
          </div>
        }
      >
        {describeError(result.error)}
      </Notice>
    )
  }

  const data = result.data!
  if (!data.analysis) {
    return (
      <Notice title="No completed analysis yet" action={<BackButton />}>
        This call has a transcript but no finished analysis. Try opening it again in a moment.
      </Notice>
    )
  }
  if (data.analysis.status !== "completed") {
    return (
      <Notice
        title={`Version ${data.analysis.version} didn't finish`}
        action={
          <Button variant="outline" size="sm" onClick={() => selectVersion(null)}>
            Show latest
          </Button>
        }
      >
        {data.analysis.error_message ?? "That analysis failed."}
      </Notice>
    )
  }
  return <ResultsView result={data} analysis={data.analysis} onSelectVersion={selectVersion} />
}
