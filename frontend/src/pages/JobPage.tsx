import { ArrowLeft } from "lucide-react"
import { Link, useParams } from "react-router"

import { Notice } from "@/components/common/Notice"
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useJob, useResult } from "@/hooks/useJobs"
import { describeError } from "@/lib/errors"
import { isJobBusy } from "@/lib/jobs"

/**
 * PLACEHOLDER so the upload flow works end to end. Next steps replace this with the
 * processing screen (while busy) and the results dashboard (when completed).
 */
export function JobPage() {
  const { id = "" } = useParams()
  const job = useJob(id)
  const result = useResult(id, job.data?.status === "completed")

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/">
          <ArrowLeft />
          All analyses
        </Link>
      </Button>

      {job.isPending && <Skeleton className="h-40 w-full" />}

      {job.isError && (
        <Notice
          title="Couldn't open this analysis"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/">Back to start</Link>
            </Button>
          }
        >
          {describeError(job.error)}
        </Notice>
      )}

      {job.data && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="truncate text-lg font-semibold">{job.data.original_filename}</h1>
              <JobStatusBadge status={job.data.status} />
            </div>

            {isJobBusy(job.data.status) && (
              <p className="text-sm text-muted-foreground">Working on it. This page updates automatically.</p>
            )}
            {job.data.status === "failed" && job.data.error_message && (
              <Notice title="This analysis failed">{job.data.error_message}</Notice>
            )}
            {result.data?.analysis && (
              <p className="text-sm">
                Tone: <strong>{result.data.analysis.tone}</strong> · {result.data.analysis.tone_evidence.length} evidence quotes ·{" "}
                {result.data.analysis.action_items.length} action items
              </p>
            )}
            <p className="text-xs text-muted-foreground">Processing screen and results dashboard: coming in the next steps.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
