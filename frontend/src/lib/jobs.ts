import type { JobStatus } from "@/types/api"

export const POLL_INTERVAL_MS = 1500

const BUSY: readonly JobStatus[] = ["queued", "transcribing", "analysing"]

/** True while the backend is still working, i.e. we should keep polling. */
export function isJobBusy(status: JobStatus): boolean {
  return BUSY.includes(status)
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "Queued",
  transcribing: "Transcribing",
  analysing: "Analysing",
  completed: "Completed",
  failed: "Failed",
}
