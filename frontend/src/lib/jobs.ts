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

// ---------- Processing screen ----------
export interface PipelineStep {
  key: "received" | "transcribing" | "analysing" | "ready"
  title: string
  description: string
}

/** What the backend really does, in order. We only know which stage is running, not sub-progress. */
export const PIPELINE_STEPS: readonly PipelineStep[] = [
  { key: "received", title: "Recording received", description: "Your audio is saved and queued." },
  { key: "transcribing", title: "Transcribing speech", description: "Converting the audio to text and separating the speakers." },
  {
    key: "analysing",
    title: "Analysing the call",
    description: "Working out who the rep is, checking their tone, finding action items, and verifying every quote against the transcript.",
  },
  { key: "ready", title: "Results ready", description: "Opening your results." },
]

/** Index of the step currently running (3 = everything done). */
export function activeStepIndex(status: JobStatus): number {
  switch (status) {
    case "queued":
      return 0
    case "transcribing":
      return 1
    case "analysing":
      return 2
    case "completed":
      return 3
    case "failed":
      return 2
  }
}

/** Which step a failed job stopped at. `failed_stage` is a loose string from the backend. */
export function failedStepIndex(stage: string | null, hasTranscript: boolean): number {
  if (stage === "transcribing") return 1
  if (stage === "analysing") return 2
  return hasTranscript ? 2 : 1 // "processing" / "interrupted" / unknown: a transcript means transcription finished
}
