import { Link, useParams } from "react-router"

import { Notice } from "@/components/common/Notice"
import { FailedView } from "@/components/processing/FailedView"
import { ProcessingView } from "@/components/processing/ProcessingView"
import { ResultsView } from "@/components/results/ResultsView"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useJob, useResult } from "@/hooks/useJobs"
import { describeError } from "@/lib/errors"
import { isJobBusy } from "@/lib/jobs"

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

/** One URL, three screens: processing while the backend works, results when done, recovery if it failed. */
export function JobPage() {
  const { id = "" } = useParams()
  const job = useJob(id)
  const status = job.data?.status
  const busy = status ? isJobBusy(status) : false
  // fetch the full result once the job stops changing (completed OR failed: a failed job may still have a transcript)
  const result = useResult(id, status !== undefined && !busy)

  if (job.isPending) return <ResultsSkeleton />

  if (job.isError) {
    return (
      <Notice title="Couldn't open this analysis" action={<BackButton />}>
        {describeError(job.error)}
      </Notice>
    )
  }

  const j = job.data!
  if (busy) return <ProcessingView job={j} />
  if (j.status === "failed") return <FailedView job={j} result={result.data} />

  // completed
  if (result.isPending) return <ResultsSkeleton />
  if (result.isError) {
    return (
      <Notice
        title="Couldn't load the results"
        action={
          <Button variant="outline" size="sm" onClick={() => result.refetch()}>
            Try again
          </Button>
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
  return <ResultsView result={data} analysis={data.analysis} />
}
