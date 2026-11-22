/**
 * Static JobResultOut fixtures for building and styling screens in isolation.
 * Frozen in time, so they never change between runs.
 *
 *   red                 RED call: rude, dismissive rep. Flips to GREEN+review at "Lenient".
 *   green               GREEN call: courteous rep, many action items (some owner/deadline "Not specified").
 *   needsReview         GREEN + "needs review": wrong role guess, a fabricated quote dropped, low confidence.
 *                       Swap roles + re-analyse to see it resolve.
 *   failedTranscription failed job with no transcript (re-upload is the only fix).
 *   failedAnalysis      failed job WITH a transcript (offer "Retry analysis").
 */
import { toResult } from "./compose"
import { createSeed } from "./seed"

const FROZEN_NOW = Date.UTC(2026, 10, 22, 9, 0, 0)
const seed = createSeed(FROZEN_NOW)

export const fixtures = {
  red: toResult(seed.red),
  green: toResult(seed.green),
  needsReview: toResult(seed.needsReview),
  failedTranscription: toResult(seed.failedTranscription),
  failedAnalysis: toResult(seed.failedAnalysis),
} as const
