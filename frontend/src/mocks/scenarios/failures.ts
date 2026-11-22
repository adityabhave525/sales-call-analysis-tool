import { buildUtterances, type ScriptLine } from "../script"
import { NO_ISSUES_RAW } from "../derive"
import type { Scenario } from "../types"

/** Transcription failed: no transcript at all. The only recovery is re-uploading. */
export const failedTranscriptionScenario: Scenario = {
  key: "failedTranscription",
  jobId: "e08b3d95-1f6c-4a27-8c49-5d2e7b9a1f04",
  filename: "voicemail_corrupt.m4a",
  sizeBytes: 412_000,
  language_code: "en",
  utterances: [],
  inferredSpeakers: [],
  summary: "",
  raw: () => NO_ISSUES_RAW,
  pool: [],
  failure: {
    stage: "transcribing",
    message: "AssemblyAI could not transcribe this audio: the file is corrupt or contains no audio.",
  },
}

const LINES: ScriptLine[] = [
  ["A", "Hi, this is Sam from Cedar Telecom. Do you have a minute to talk about your internet plan?"],
  ["B", "Sure, but I only have a couple of minutes."],
  ["A", "No problem. Your contract ends next month, and I can offer a faster plan for the same price."],
  ["B", "That sounds interesting. Please email me the details and I'll look at them this weekend."],
  ["A", "Will do. I'll send the plan comparison to you today."],
  ["B", "Great, thanks Sam."],
]

/**
 * Transcript exists but the analysis step failed (rate limit). Recovery is "Retry analysis"
 * (no re-upload, no extra transcription cost). The first retry succeeds.
 */
export const failedAnalysisScenario: Scenario = {
  key: "failedAnalysis",
  jobId: "5a7c2e61-8b04-4d19-a3f6-9c1d4e8b2a05",
  filename: "Cedar_plan_upgrade.mp3",
  sizeBytes: 640_000,
  language_code: "en",
  utterances: buildUtterances(LINES, 5000),
  inferredSpeakers: [
    { label: "A", role: "rep", role_confidence: 0.93, role_source: "auto", role_reasoning: "Introduces himself and the company, then pitches a plan." },
    { label: "B", role: "customer", role_confidence: 0.9, role_source: "auto", role_reasoning: "Receives the pitch and asks for details by email." },
  ],
  summary: "The rep offers a faster internet plan at the same price. The customer asks for the details by email.",
  raw: (rep) =>
    rep === "A"
      ? {
          negative: false,
          confidence: 0.92,
          explanation: "The rep was polite and respected the customer's limited time. No negative tone was found.",
          evidence: [],
        }
      : NO_ISSUES_RAW,
  pool: [
    {
      utterance_index: 4,
      quote: "I'll send the plan comparison to you today",
      description: "Send the plan comparison to the customer",
      item_type: "send_information",
      deadline_text: "today",
      confidence: 0.92,
    },
    {
      utterance_index: 3,
      quote: "I'll look at them this weekend",
      description: "Review the plan details",
      item_type: "commitment",
      deadline_text: "this weekend",
      confidence: 0.6,
      loose: true,
    },
  ],
  failure: {
    stage: "analysing",
    message: "Anthropic rate limit reached. Wait a minute and re-run the analysis.",
  },
}
