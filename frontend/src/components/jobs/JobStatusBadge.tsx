import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { STATUS_LABEL } from "@/lib/jobs"
import { cn } from "@/lib/utils"
import type { JobStatus } from "@/types/api"

/** Processing state of a job. Deliberately NOT red/green: those colours mean tone. */
const STYLES: Record<JobStatus, string> = {
  queued: "border-border bg-muted text-muted-foreground",
  transcribing: "border-sky-200 bg-sky-50 text-sky-800",
  analysing: "border-sky-200 bg-sky-50 text-sky-800",
  completed: "border-border bg-background text-foreground",
  failed: "border-amber-200 bg-amber-50 text-amber-900",
}

function StatusIcon({ status }: { status: JobStatus }) {
  switch (status) {
    case "queued":
      return <Clock />
    case "transcribing":
    case "analysing":
      return <Loader2 className="animate-spin" />
    case "completed":
      return <CheckCircle2 />
    case "failed":
      return <AlertTriangle />
  }
}

export function JobStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", STYLES[status], className)}>
      <StatusIcon status={status} />
      {STATUS_LABEL[status]}
    </Badge>
  )
}
