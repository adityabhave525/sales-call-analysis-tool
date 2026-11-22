/**
 * The real client: talks to the FastAPI backend. Same interface as the mock
 * (src/api/contract.ts), so no screen knows which one it is using.
 */
import type {
  AnalysisSettings,
  HealthOut,
  JobOut,
  JobResultOut,
  SpeakerOut,
  ValidationIssue,
} from "@/types/api"
import { ApiError, type CallAnalyzerApi } from "./contract"

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

export const API_BASE = (env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "")

/** FastAPI errors are {detail: "text"} for our own errors, or {detail: [{loc, msg}]} for validation. */
export function messageFromBody(body: unknown, status: number): string {
  const detail = typeof body === "object" && body !== null ? (body as { detail?: unknown }).detail : undefined
  if (typeof detail === "string" && detail) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as ValidationIssue
    const where = (first.loc ?? []).filter((p) => p !== "body" && p !== "query").join(".")
    return where ? `${where}: ${first.msg}` : first.msg
  }
  return status >= 500
    ? `The server hit an error (${status}). Check the backend logs.`
    : `Request failed (${status}).`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init) // network failure => TypeError (see describeError)
  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* non-JSON error body (e.g. a proxy page) */
    }
    throw new ApiError(res.status, messageFromBody(body, res.status))
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

const enc = encodeURIComponent

export const httpApi: CallAnalyzerApi = {
  health: () => request<HealthOut>("/api/health"),
  getDefaultSettings: () => request<AnalysisSettings>("/api/settings/defaults"),

  listJobs: (limit = 50) => request<JobOut[]>(`/api/jobs?limit=${limit}`),
  getJob: (id) => request<JobOut>(`/api/jobs/${enc(id)}`),
  getResult: (id, version) =>
    request<JobResultOut>(`/api/jobs/${enc(id)}/result${version !== undefined ? `?version=${version}` : ""}`),

  uploadJob(file, settings) {
    const form = new FormData() // multipart; the browser sets the boundary header itself
    form.append("file", file)
    form.append("settings", JSON.stringify(settings))
    return request<JobOut>("/api/jobs", { method: "POST", body: form })
  },
  reanalyse: (id, settings) => request<JobOut>(`/api/jobs/${enc(id)}/reanalyse`, json("POST", settings)),
  assignRep: (id, repLabel) =>
    request<SpeakerOut[]>(`/api/jobs/${enc(id)}/speakers`, json("PUT", { rep_label: repLabel })),
  deleteJob: (id) => request<void>(`/api/jobs/${enc(id)}`, { method: "DELETE" }),

  audioUrl: (id) => `${API_BASE}/api/jobs/${enc(id)}/audio`,
}
