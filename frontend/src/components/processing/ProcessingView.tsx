import { Link } from "react-router"

import { Notice } from "@/components/common/Notice"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useElapsedMs } from "@/hooks/useElapsed"
import { formatBytes, formatClock } from "@/lib/format"
import { activeStepIndex, STATUS_LABEL } from "@/lib/jobs"
import type { JobOut } from "@/types/api"
import { StepList } from "./StepList"

/** `startIso` lets a retry count from when the retry began instead of from the original upload. */
export function ProcessingView({ job, startIso }: { job: JobOut; startIso?: string }) {
  const elapsed = useElapsedMs(startIso ?? job.created_at)

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <header className="space-y-1">
          <p className="text-sm text-muted-foreground">Analysing your call</p>
          <h1 className="truncate text-xl font-semibold" title={job.original_filename}>
            {job.original_filename}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatBytes(job.size_bytes)} · Elapsed {formatClock(elapsed)}
          </p>
        </header>

        {/* screen readers hear each stage change */}
        <p className="sr-only" aria-live="polite">
          {STATUS_LABEL[job.status]}
        </p>

        <StepList
          activeIndex={activeStepIndex(job.status)}
          currentNote={job.status === "queued" ? "Waiting to start…" : undefined}
        />

        <Notice variant="info">
          Longer recordings take longer. You can leave this page: the analysis keeps running and will appear under
          Recent analyses.
        </Notice>

        <Button asChild variant="outline">
          <Link to="/">Back to all analyses</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
