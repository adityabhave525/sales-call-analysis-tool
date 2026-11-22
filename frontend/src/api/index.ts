import { mockApi } from "@/mocks/mockApi"
import type { CallAnalyzerApi } from "./contract"

/**
 * The only place that decides which backend the UI talks to.
 * Mock for now; when we connect, this becomes the fetch client (or an env-flag switch).
 */
export const api: CallAnalyzerApi = mockApi

export { ApiError, isApiError } from "./contract"
export type { CallAnalyzerApi } from "./contract"
