import { mockApi } from "@/mocks/mockApi"
import type { CallAnalyzerApi } from "./contract"
import { httpApi } from "./httpClient"

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

/** Set VITE_USE_MOCK=true in .env.local to run without the backend (scripted demo data). */
export const USE_MOCK = env.VITE_USE_MOCK === "true"

/** The only place that decides which backend the UI talks to. */
export const api: CallAnalyzerApi = USE_MOCK ? mockApi : httpApi

export { API_BASE } from "./httpClient"
export { ApiError, isApiError } from "./contract"
export type { CallAnalyzerApi } from "./contract"
