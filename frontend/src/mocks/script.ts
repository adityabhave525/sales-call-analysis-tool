import type { UtteranceOut } from "@/types/api"

/** [speaker label, text]. Labels are diarization labels: "A", "B". */
export type ScriptLine = readonly [speaker: string, text: string]

/** UtteranceOut before roles are applied (roles live on the speakers, not the lines). */
export type RawUtterance = Omit<UtteranceOut, "role">

/** Same idea as the backend's verifier: ignore case, punctuation and apostrophes. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function quoteInText(quote: string, text: string): boolean {
  const q = normalizeText(quote)
  return q.length > 0 && ` ${normalizeText(text)} `.includes(` ${q} `)
}

/**
 * Turns a script into timed utterances at natural speaking pace (~150 wpm),
 * with small deterministic pauses. Deterministic on purpose: fixtures never change.
 */
export function buildUtterances(lines: readonly ScriptLine[], baseId: number): RawUtterance[] {
  let cursor = 800
  return lines.map(([speaker, text], idx) => {
    const words = text.trim().split(/\s+/).length
    const start = cursor
    const end = start + Math.max(1200, Math.round(words * 390))
    cursor = end + 350 + ((idx * 137) % 700)
    return {
      id: baseId + idx,
      idx,
      speaker_label: speaker,
      start_ms: start,
      end_ms: end,
      text,
      confidence: Number((0.9 + ((idx * 37) % 9) / 100).toFixed(2)),
    }
  })
}

export function callDurationMs(utterances: readonly RawUtterance[]): number {
  const last = utterances[utterances.length - 1]
  return last ? last.end_ms + 1500 : 0
}
