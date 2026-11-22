import { createDefaultSettings } from "@/lib/settings"
import type { AnalysisSettings, SpeakerOut } from "@/types/api"
import { deriveAnalysis, failedAnalysis } from "./derive"
import { callDurationMs } from "./script"
import {
  failedAnalysisScenario,
  failedTranscriptionScenario,
  greenScenario,
  needsReviewScenario,
  redScenario,
} from "./scenarios"
import type { MockJob, Scenario } from "./types"

/** Naive-UTC ISO string, exactly how the backend serialises datetimes (no "Z"). */
export function serverIso(ms: number): string {
  return new Date(ms).toISOString().replace("Z", "")
}

export function unknownSpeakers(scenario: Scenario): SpeakerOut[] {
  const labels = [...new Set(scenario.utterances.map((u) => u.speaker_label))].sort()
  return labels.map((label) => ({
    label,
    role: "unknown",
    role_confidence: null,
    role_source: "auto",
    role_reasoning: null,
  }))
}

function baseJob(scenario: Scenario, createdMs: number): MockJob {
  return {
    scenario,
    job: {
      id: scenario.jobId,
      original_filename: scenario.filename,
      size_bytes: scenario.sizeBytes,
      duration_ms: scenario.utterances.length ? callDurationMs(scenario.utterances) : null,
      status: "completed",
      failed_stage: null,
      error_message: null,
      created_at: serverIso(createdMs),
      updated_at: serverIso(createdMs + 90_000),
    },
    hasTranscript: scenario.utterances.length > 0,
    speakers: [],
    analyses: [],
    plan: null,
    failuresLeft: 0,
  }
}

function completedJob(scenario: Scenario, createdMs: number, settings: AnalysisSettings): MockJob {
  const m = baseJob(scenario, createdMs)
  m.speakers = scenario.inferredSpeakers.map((s) => ({ ...s }))
  m.analyses = [
    deriveAnalysis({
      scenario,
      utterances: scenario.utterances,
      speakers: m.speakers,
      settings,
      version: 1,
      createdAt: serverIso(createdMs + 60_000),
      completedAt: serverIso(createdMs + 90_000),
    }),
  ]
  return m
}

const MIN = 60_000
const HOUR = 60 * MIN

/** The five fixture jobs. `now` is a parameter so fixtures can be frozen in time. */
export function createSeed(now: number) {
  const settings = createDefaultSettings()

  const failedTranscription = baseJob(failedTranscriptionScenario, now - 5 * HOUR)
  failedTranscription.job.status = "failed"
  failedTranscription.job.failed_stage = "transcribing"
  failedTranscription.job.error_message = failedTranscriptionScenario.failure?.message ?? null
  failedTranscription.job.duration_ms = null

  const failedAnalysisJob = baseJob(failedAnalysisScenario, now - 30 * MIN)
  failedAnalysisJob.speakers = unknownSpeakers(failedAnalysisScenario) // roles not inferred yet
  failedAnalysisJob.analyses = [
    failedAnalysis(
      1,
      settings,
      failedAnalysisScenario.failure?.message ?? "Analysis failed.",
      serverIso(now - 29 * MIN),
    ),
  ]
  failedAnalysisJob.job.status = "failed"
  failedAnalysisJob.job.failed_stage = "analysing"
  failedAnalysisJob.job.error_message = failedAnalysisScenario.failure?.message ?? null

  return {
    red: completedJob(redScenario, now - 2 * HOUR, settings),
    green: completedJob(greenScenario, now - 26 * HOUR, settings),
    needsReview: completedJob(needsReviewScenario, now - 3 * HOUR, settings),
    failedTranscription,
    failedAnalysis: failedAnalysisJob,
  }
}
