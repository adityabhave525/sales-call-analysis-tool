/**
 * In-memory stand-in for the FastAPI backend. Same endpoints (see
 * src/api/contract.ts), same status progression, same error messages.
 * State resets on page refresh.
 *
 * Status is computed from elapsed time whenever a job is read ("settle"), so
 * there are no timers to leak and polling just works.
 */
import { ApiError, type CallAnalyzerApi } from "@/api/contract"
import { createDefaultSettings } from "@/lib/settings"
import type { AnalysisSettings, JobOut, SpeakerOut } from "@/types/api"
import { toResult } from "./compose"
import { deriveAnalysis, failedAnalysis } from "./derive"
import { pickScenario } from "./scenarios"
import { createSeed, serverIso, unknownSpeakers } from "./seed"
import { callDurationMs } from "./script"
import type { MockJob, PlanKind } from "./types"
import { makeSilentWavUrl } from "./wav"

/** Tweak these from the browser console or a dev panel. */
export const mockControls = {
  latencyMs: 300,
  now: (): number => Date.now(),
  /** Set true to make the NEXT analysis run fail (e.g. to test the error UI after a re-analyse). */
  failNextAnalysis: false,
}

// Pipeline timing (ms since the job started)
const QUEUE_MS = 400
const TRANSCRIBE_MS = 3500
const ANALYSE_MS = 3000
const REANALYSE_MS = 2500

const MAX_UPLOAD_MB = 100

let state: Map<string, MockJob> | null = null
const audioUrls = new Map<string, string>()

function db(): Map<string, MockJob> {
  if (!state) {
    state = new Map(Object.values(createSeed(mockControls.now())).map((m) => [m.job.id, m]))
  }
  return state
}

/** Test helper: forget everything and re-seed on next use. */
export function resetMockApi(): void {
  state = null
  audioUrls.clear()
}

const delay = () =>
  mockControls.latencyMs > 0 ? new Promise<void>((r) => setTimeout(r, mockControls.latencyMs)) : Promise.resolve()

function get(id: string): MockJob {
  const m = db().get(id)
  if (!m) throw new ApiError(404, "Job not found.")
  settle(m)
  return m
}

const BUSY = new Set(["queued", "transcribing", "analysing"])
const isBusy = (m: MockJob) => BUSY.has(m.job.status)

function touch(m: MockJob, status: JobOut["status"]): void {
  // like the backend, updated_at only moves when something actually changes
  if (m.job.status !== status) m.job.updated_at = serverIso(mockControls.now())
  m.job.status = status
}

function failJob(m: MockJob, stage: string, message: string): void {
  touch(m, "failed")
  m.job.failed_stage = stage
  m.job.error_message = message
  m.plan = null
}

/** Advance a job according to how much time has passed since it started. */
function settle(m: MockJob): void {
  const plan = m.plan
  if (!plan) return
  const elapsed = mockControls.now() - plan.startedAt

  if (plan.kind === "full") {
    const transcribeEnd = QUEUE_MS + TRANSCRIBE_MS
    if (elapsed < QUEUE_MS) return touch(m, "queued")
    if (elapsed < transcribeEnd) return touch(m, "transcribing")

    if (!m.hasTranscript) {
      const failure = m.scenario.failure
      if (failure?.stage === "transcribing") return failJob(m, "transcribing", failure.message)
      m.hasTranscript = true
      m.speakers = unknownSpeakers(m.scenario) // backend creates speaker rows when saving the transcript
      m.job.duration_ms = callDurationMs(m.scenario.utterances)
    }
    if (elapsed < transcribeEnd + ANALYSE_MS) return touch(m, "analysing")
  } else if (elapsed < REANALYSE_MS) {
    return touch(m, "analysing")
  }

  finishAnalysis(m, plan.settings)
}

function finishAnalysis(m: MockJob, settings: AnalysisSettings): void {
  const now = serverIso(mockControls.now())
  const version = m.analyses.reduce((max, a) => Math.max(max, a.version), 0) + 1
  const failure = m.scenario.failure
  const injected = mockControls.failNextAnalysis
  const scripted = failure?.stage === "analysing" && m.failuresLeft > 0

  if (injected || scripted) {
    if (injected) mockControls.failNextAnalysis = false
    else m.failuresLeft--
    const message = failure?.message ?? "Anthropic rate limit reached. Wait a minute and re-run the analysis."
    m.analyses.push(failedAnalysis(version, settings, message, now))
    const hadGood = m.analyses.some((a) => a.status === "completed")
    // a failed re-analysis must not hide an earlier good result
    touch(m, hadGood ? "completed" : "failed")
    m.job.failed_stage = hadGood ? null : "analysing"
    m.job.error_message = message
    m.plan = null
    return
  }

  // roles are inferred once and then kept (including any manual override)
  if (!m.speakers.some((s) => s.role === "rep" || s.role === "customer")) {
    m.speakers = m.scenario.inferredSpeakers.map((s) => ({ ...s }))
  }
  m.analyses.push(
    deriveAnalysis({
      scenario: m.scenario,
      utterances: m.scenario.utterances,
      speakers: m.speakers,
      settings,
      version,
      createdAt: now,
      completedAt: now,
    }),
  )
  touch(m, "completed")
  m.job.failed_stage = null
  m.job.error_message = null
  m.plan = null
}

function startPlan(m: MockJob, kind: PlanKind, settings: AnalysisSettings): void {
  m.plan = { kind, startedAt: mockControls.now(), settings: structuredClone(settings) }
}

const copy = <T>(v: T): T => structuredClone(v)

export const mockApi: CallAnalyzerApi = {
  async health() {
    await delay()
    return { status: "ok", assemblyai_key_set: true, anthropic_key_set: true }
  },

  async getDefaultSettings() {
    await delay()
    return createDefaultSettings()
  },

  async listJobs(limit = 50) {
    await delay()
    const all = [...db().values()]
    all.forEach(settle)
    return all
      .map((m) => copy(m.job))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, Math.min(limit, 200))
  },

  async getJob(id) {
    await delay()
    return copy(get(id).job)
  },

  async getResult(id, version) {
    await delay()
    return copy(toResult(get(id), version))
  },

  async uploadJob(file, settings) {
    await delay()
    const ext = /\.[^.]+$/.exec(file.name.toLowerCase())?.[0] ?? ""
    if (ext !== ".m4a" && ext !== ".mp3") {
      throw new ApiError(415, "Unsupported file type. Please upload a .m4a or .mp3 file.")
    }
    if (file.size === 0) throw new ApiError(400, "The uploaded file is empty.")
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      throw new ApiError(413, `File too large (max ${MAX_UPLOAD_MB} MB).`)
    }

    const scenario = pickScenario(file.name)
    const now = mockControls.now()
    const id = crypto.randomUUID()
    const m: MockJob = {
      scenario,
      job: {
        id,
        original_filename: file.name,
        size_bytes: file.size,
        duration_ms: null,
        status: "queued",
        failed_stage: null,
        error_message: null,
        created_at: serverIso(now),
        updated_at: serverIso(now),
      },
      hasTranscript: false,
      speakers: [],
      analyses: [],
      plan: null,
      failuresLeft: scenario.failure?.stage === "analysing" ? 1 : 0,
    }
    startPlan(m, "full", settings)
    db().set(id, m)
    return copy(m.job)
  },

  async reanalyse(id, settings) {
    await delay()
    const m = get(id)
    if (isBusy(m)) throw new ApiError(409, "This call is still being processed. Wait for it to finish.")
    if (!m.hasTranscript) {
      throw new ApiError(409, "There is no transcript to analyse (transcription failed). Please upload the file again.")
    }
    m.job.error_message = null
    m.job.failed_stage = null
    touch(m, "analysing")
    startPlan(m, "reanalyse", settings)
    return copy(m.job)
  },

  async assignRep(id, repLabel) {
    await delay()
    const m = get(id)
    if (isBusy(m)) throw new ApiError(409, "This call is still being processed. Wait for it to finish.")
    if (m.speakers.length === 0) {
      throw new ApiError(409, "No speakers available yet (transcription has not completed).")
    }
    const labels = m.speakers.map((s) => s.label).sort()
    if (!labels.includes(repLabel)) {
      throw new ApiError(422, `Unknown speaker '${repLabel}'. Valid labels: ${JSON.stringify(labels)}`)
    }
    m.speakers = m.speakers.map<SpeakerOut>((s) => ({
      ...s,
      role: s.label === repLabel ? "rep" : "customer",
      role_source: "user",
      role_confidence: 1,
      role_reasoning: "Set manually by the user.",
    }))
    return copy(m.speakers)
  },

  async deleteJob(id) {
    await delay()
    if (!db().delete(id)) throw new ApiError(404, "Job not found.")
    const url = audioUrls.get(id)
    if (url) {
      URL.revokeObjectURL(url)
      audioUrls.delete(id)
    }
  },

  audioUrl(id) {
    const cached = audioUrls.get(id)
    if (cached) return cached
    const m = db().get(id)
    const url = makeSilentWavUrl(m?.job.duration_ms ?? 60_000)
    audioUrls.set(id, url)
    return url
  },
}
