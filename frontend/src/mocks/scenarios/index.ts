import type { Scenario } from "../types"
import { failedAnalysisScenario, failedTranscriptionScenario } from "./failures"
import { greenScenario } from "./green"
import { needsReviewScenario } from "./needsReview"
import { redScenario } from "./red"

export { failedAnalysisScenario, failedTranscriptionScenario, greenScenario, needsReviewScenario, redScenario }

/**
 * In mock mode an uploaded file's NAME decides which scripted call it "contains":
 *   rude / red / angry   -> RED call
 *   review / unsure / swap -> needs-review call (wrong role guess; try "Swap roles")
 *   corrupt / fail / error -> transcription fails
 *   ratelimit / retry    -> analysis fails once, then succeeds on retry
 *   anything else        -> GREEN call
 */
export function pickScenario(filename: string): Scenario {
  // whole words only, so "preferred_customer.m4a" doesn't count as "red"
  const words = filename.toLowerCase().split(/[^a-z0-9]+/)
  const has = (...keys: string[]) => keys.some((k) => words.includes(k))
  if (has("rude", "red", "angry")) return redScenario
  if (has("review", "unsure", "swap")) return needsReviewScenario
  if (has("corrupt", "fail", "error")) return failedTranscriptionScenario
  if (has("ratelimit", "retry")) return failedAnalysisScenario
  return greenScenario
}
