import type { UtteranceVoiceOut, VoiceFlagOut } from "@/types/api"

const ANGRY: VoiceFlagOut = { key: "angry", label: "Angry-sounding voice", strength: "high" }
const HEATED: VoiceFlagOut = { key: "heated", label: "Negative and intense delivery", strength: "medium" }
const AGITATED: VoiceFlagOut = { key: "agitated", label: "More agitated than their own norm", strength: "medium" }

/** Demo voice measurements. Numbers are invented but shaped like the real thing. */
export function calm(arousal: number, valence = 0.2): UtteranceVoiceOut {
  return { coverage: 1, flags: [], cues: [], arousal, valence, angry: 0.05, arousal_z: null, valence_z: null }
}

export function flagged(kind: "angry" | "heated" | "agitated", arousal: number, valence: number, z = 2.2): UtteranceVoiceOut {
  const flag = kind === "angry" ? ANGRY : kind === "heated" ? HEATED : AGITATED
  return {
    coverage: 1,
    flags: [flag],
    cues: [flag.label.toLowerCase()],
    arousal,
    valence,
    angry: kind === "angry" ? 0.81 : 0.32,
    arousal_z: z,
    valence_z: -z,
  }
}
