import { ApiError } from "@/api/contract"
import type { JobResultOut } from "@/types/api"
import type { MockJob } from "./types"

/** Same shape and rules as the backend's GET /api/jobs/{id}/result. */
export function toResult(m: MockJob, version?: number): JobResultOut {
  const roleOf = (label: string) => m.speakers.find((s) => s.label === label)?.role ?? "unknown"

  let analysis = null
  if (version !== undefined) {
    analysis = m.analyses.find((a) => a.version === version) ?? null
    if (!analysis) throw new ApiError(404, `Analysis version ${version} not found.`)
  } else {
    const completed = m.analyses.filter((a) => a.status === "completed")
    analysis = completed.length ? completed[completed.length - 1] : null
  }

  return {
    job: { ...m.job },
    language_code: m.hasTranscript ? m.scenario.language_code : null,
    utterances: m.hasTranscript
      ? m.scenario.utterances.map((u) => ({ ...u, role: roleOf(u.speaker_label) }))
      : [],
    speakers: m.speakers.map((s) => ({ ...s })),
    analysis,
    versions: m.analyses.map((a) => ({
      version: a.version,
      status: a.status,
      tone: a.tone,
      llm_model: a.llm_model,
      created_at: a.created_at,
    })),
  }
}
