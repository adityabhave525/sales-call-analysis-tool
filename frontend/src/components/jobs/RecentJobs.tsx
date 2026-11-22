import { useState } from "react"
import { FileAudio, EllipsisVertical, RefreshCw } from "lucide-react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"

import { Notice } from "@/components/common/Notice"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeleteJob, useJobs } from "@/hooks/useJobs"
import { describeError } from "@/lib/errors"
import { formatBytes, formatDateTime, formatDuration } from "@/lib/format"
import type { JobOut } from "@/types/api"
import { JobStatusBadge } from "./JobStatusBadge"

function JobRow({ job, onDelete }: { job: JobOut; onDelete: (job: JobOut) => void }) {
  const navigate = useNavigate()
  const meta = [
    formatDateTime(job.created_at),
    job.duration_ms != null ? formatDuration(job.duration_ms) : null,
    formatBytes(job.size_bytes),
  ].filter(Boolean)

  return (
    // The filename link stretches over the whole row (after:absolute). The menu sits above it
    // (relative z-10), so we never nest a button inside a link.
    <li className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-6">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileAudio className="size-4 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <Link
          to={`/jobs/${job.id}`}
          className="block truncate text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          title={job.original_filename}
        >
          {job.original_filename}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{meta.join(" · ")}</p>
        {job.status === "failed" && job.error_message && (
          <p className="mt-0.5 line-clamp-1 text-xs text-amber-800" title={job.error_message}>
            {job.error_message}
          </p>
        )}
      </div>

      <JobStatusBadge status={job.status} className="hidden sm:inline-flex" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative z-10" aria-label={`Actions for ${job.original_filename}`}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => navigate(`/jobs/${job.id}`)}>Open</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDelete(job)}>Delete…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

export function RecentJobs() {
  const { data, isPending, isError, error, refetch, isFetching } = useJobs()
  const deleteJob = useDeleteJob()
  const [toDelete, setToDelete] = useState<JobOut | null>(null)

  function confirmDelete() {
    const job = toDelete
    if (!job) return
    deleteJob.mutate(job.id, {
      onSuccess: () => toast.success(`Deleted “${job.original_filename}”`),
      onError: (e) => toast.error(describeError(e)),
    })
  }

  return (
    <section aria-labelledby="recent-heading" className="space-y-3">
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <h2 id="recent-heading" className="text-base font-semibold">
            Recent analyses
          </h2>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh list">
            <RefreshCw className={isFetching ? "animate-spin" : undefined} />
          </Button>
        </div>

        <CardContent className="p-0">
          {isPending && (
            <div className="space-y-4 p-4 sm:p-6" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="p-4 sm:p-6">
              <Notice
                title="Couldn't load your analyses"
                action={
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Try again
                  </Button>
                }
              >
                {describeError(error)}
              </Notice>
            </div>
          )}

          {data && data.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <FileAudio className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No analyses yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Upload a call above and it will show up here, so you can come back to it later.
              </p>
            </div>
          )}

          {data && data.length > 0 && (
            <ul className="divide-y">
              {data.map((job) => (
                <JobRow key={job.id} job={job} onDelete={setToDelete} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={toDelete !== null} onOpenChange={(open: boolean) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.original_filename}”, its transcript and all results will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
