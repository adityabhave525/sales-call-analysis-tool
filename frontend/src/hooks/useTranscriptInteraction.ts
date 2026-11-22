import { useCallback, useEffect, useRef, useState } from "react"

import { findUtteranceAt } from "@/lib/results"
import type { UtteranceOut } from "@/types/api"

/**
 * Everything that links the transcript, the audio and the evidence lists:
 *  - jumpTo(): highlight + scroll to a line, seek the audio (and play)
 *  - the line currently being spoken, for a live highlight
 * Shared by the results dashboard and the failed-job view.
 */
export function useTranscriptInteraction(utterances: readonly UtteranceOut[]) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const lineRefs = useRef(new Map<number, HTMLElement>())
  const [activeId, setActiveId] = useState<number | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)

  // the "jumped to" highlight fades after a few seconds
  useEffect(() => {
    if (activeId === null) return
    const timer = setTimeout(() => setActiveId(null), 6000)
    return () => clearTimeout(timer)
  }, [activeId])

  const registerLine = useCallback((id: number, el: HTMLElement | null) => {
    if (el) lineRefs.current.set(id, el)
    else lineRefs.current.delete(id)
  }, [])

  const jumpTo = useCallback((utteranceId: number | null, startMs: number | null, play = true) => {
    if (utteranceId !== null) {
      setActiveId(utteranceId)
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      lineRefs.current.get(utteranceId)?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" })
    }
    const audio = audioRef.current
    if (audio && startMs !== null) {
      audio.currentTime = Math.max(0, startMs / 1000)
      if (play) void audio.play().catch(() => undefined) // the browser may refuse autoplay; seeking still worked
    }
  }, [])

  /** Called from the audio element: ms position, or null when paused/ended. */
  const onPlaybackPosition = useCallback(
    (ms: number | null) => setPlayingId(ms === null ? null : (findUtteranceAt(utterances, ms)?.id ?? null)),
    [utterances],
  )

  return { audioRef, activeId, playingId, registerLine, jumpTo, onPlaybackPosition }
}
