/** Small presentation helpers for voice signals. Pure. */
import type { EvidenceBasis, UtteranceOut, VoiceFlagOut } from "@/types/api"

export const BASIS_LABEL: Record<EvidenceBasis, string> = {
  words: "Words",
  voice: "Voice",
  words_and_voice: "Words + voice",
}

export const BASIS_HELP: Record<EvidenceBasis, string> = {
  words: "Based on what was said.",
  voice: "Based on how it was said (measured from the audio). The words alone look neutral.",
  words_and_voice: "Based on what was said and how it was said.",
}

export const STRENGTH_RANK = { low: 1, medium: 2, high: 3 } as const

export function strongestFlag(flags: readonly VoiceFlagOut[]): VoiceFlagOut | null {
  return flags.reduce<VoiceFlagOut | null>(
    (best, f) => (best === null || STRENGTH_RANK[f.strength] > STRENGTH_RANK[best.strength] ? f : best),
    null,
  )
}

/** Tooltip text with the numbers behind a line's voice flags. */
export function describeVoice(u: UtteranceOut): string | undefined {
  const v = u.voice
  if (!v) return undefined
  const parts: string[] = []
  if (v.angry != null) parts.push(`anger ${Math.round(v.angry * 100)}%`)
  if (v.arousal_z != null) parts.push(`energy ${v.arousal_z >= 0 ? "+" : ""}${v.arousal_z.toFixed(1)}σ vs this speaker's norm`)
  if (v.valence_z != null) parts.push(`positivity ${v.valence_z >= 0 ? "+" : ""}${v.valence_z.toFixed(1)}σ`)
  if (v.coverage != null && v.coverage < 0.7) parts.push(`voice measured for ${Math.round(v.coverage * 100)}% of this line`)
  return parts.length ? `Measured from the audio: ${parts.join(", ")}` : undefined
}

/** The rep's lines that have any measured energy, for the timeline. */
export function repVoiceLines(utterances: readonly UtteranceOut[]): UtteranceOut[] {
  return utterances.filter((u) => u.role === "rep" && u.voice != null)
}
