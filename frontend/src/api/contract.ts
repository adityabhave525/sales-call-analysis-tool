/**
 * The one interface the UI talks to. Today it is implemented by the mock
 * (src/mocks/mockApi.ts); later by a real fetch client. Screens never import
 * either directly, only `api` from src/api/index.ts, so switching is one line.
 *
 * Behaviour mirrors the FastAPI backend, including its error messages.
 */
import type {
  AnalysisSettings,
  HealthOut,
  JobOut,
  JobResultOut,
  SpeakerOut,
} from "@/types/api"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

export interface CallAnalyzerApi {
  health(): Promise<HealthOut>
  getDefaultSettings(): Promise<AnalysisSettings>

  listJobs(limit?: number): Promise<JobOut[]>
  /** Cheap status check: this is what polling calls. */
  getJob(id: string): Promise<JobOut>
  /** Everything the results page needs. Latest completed analysis unless `version` is given. */
  getResult(id: string, version?: number): Promise<JobResultOut>

  /** Throws ApiError 415 (type), 413 (size), 400 (empty). Returns immediately; poll getJob. */
  uploadJob(file: File, settings: AnalysisSettings): Promise<JobOut>
  /** Re-runs only the analysis step. ApiError 409 if busy or there is no transcript. */
  reanalyse(id: string, settings: AnalysisSettings): Promise<JobOut>
  /** "Swap roles". Everyone else becomes the customer. Call reanalyse afterwards to apply it. */
  assignRep(id: string, repLabel: string): Promise<SpeakerOut[]>
  deleteJob(id: string): Promise<void>

  /** URL usable as <audio src>. */
  audioUrl(id: string): string
}
