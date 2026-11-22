import { isApiError } from "@/api/contract"

/** Turns anything thrown into a sentence a user can act on. */
export function describeError(e: unknown): string {
  if (isApiError(e)) return e.message
  // fetch() throws TypeError when the server is unreachable
  if (e instanceof TypeError) return "Could not reach the server. Check that the backend is running and try again."
  if (e instanceof Error && e.message) return e.message
  return "Something went wrong. Please try again."
}

/** Retry only what might heal itself: not 4xx answers like "job not found". */
export function shouldRetry(failureCount: number, e: unknown): boolean {
  if (isApiError(e) && e.status >= 400 && e.status < 500) return false
  return failureCount < 2
}
