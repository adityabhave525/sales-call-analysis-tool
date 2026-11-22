import { memo, useCallback, useState } from "react"
import { ListChecks, Play } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { useTranscriptInteraction } from "@/hooks/useTranscriptInteraction"
import { formatClock } from "@/lib/format"
import { isLowConfidence, speakerName, type LineMarkers } from "@/lib/results"
import { cn } from "@/lib/utils"
import type { Role, SpeakerOut, UtteranceOut } from "@/types/api"

const ROLE_STYLE: Record<Role, { name: string; bubble: string }> = {
  rep: { name: "text-violet-700", bubble: "border-violet-100 bg-violet-50" },
  customer: { name: "text-stone-700", bubble: "border-stone-200 bg-stone-100" },
  unknown: { name: "text-muted-foreground", bubble: "border-border bg-muted" },
}

interface LineProps {
  u: UtteranceOut
  markers: LineMarkers | undefined
  isActive: boolean
  isPlaying: boolean
  registerLine: (id: number, el: HTMLElement | null) => void
  onPlay: (u: UtteranceOut) => void
}

const TranscriptLine = memo(function TranscriptLine({ u, markers, isActive, isPlaying, registerLine, onPlay }: LineProps) {
  const setRef = useCallback((el: HTMLDivElement | null) => registerLine(u.id, el), [registerLine, u.id])
  const style = ROLE_STYLE[u.role]
  const alignRight = u.role === "customer"

  return (
    <div ref={setRef} className={cn("flex flex-col gap-1", alignRight ? "items-end" : "items-start")}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("font-medium", style.name)}>{speakerName(u.role, u.speaker_label)}</span>
        <button
          type="button"
          onClick={() => onPlay(u)}
          className="inline-flex items-center gap-1 rounded tabular-nums text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2"
          aria-label={`Play from ${formatClock(u.start_ms)}`}
        >
          <Play className="size-3" />
          {formatClock(u.start_ms)}
        </button>
        {markers?.evidence && (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] font-normal text-amber-900">
            Tone evidence
          </Badge>
        )}
        {markers?.action && (
          <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px] font-normal">
            <ListChecks className="size-3" />
            Action item
          </Badge>
        )}
      </div>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl border px-3.5 py-2 text-sm leading-relaxed transition-shadow",
          style.bubble,
          isPlaying && "ring-2 ring-sky-400",
          isActive && "ring-2 ring-foreground",
          isLowConfidence(u.confidence) && "italic",
        )}
        title={isLowConfidence(u.confidence) ? "The transcription service was unsure about this line" : undefined}
      >
        {u.text}
      </div>
    </div>
  )
})

interface TranscriptPanelProps {
  title?: string
  utterances: readonly UtteranceOut[]
  speakers: readonly SpeakerOut[]
  markers: Map<number, LineMarkers>
  audioSrc: string
  interaction: ReturnType<typeof useTranscriptInteraction>
}

export function TranscriptPanel({
  title = "Transcript",
  utterances,
  speakers,
  markers,
  audioSrc,
  interaction,
}: TranscriptPanelProps) {
  const { audioRef, activeId, playingId, registerLine, jumpTo, onPlaybackPosition } = interaction
  const [audioFailed, setAudioFailed] = useState(false)
  const onPlay = useCallback((u: UtteranceOut) => jumpTo(u.id, u.start_ms, true), [jumpTo])
  const uncertainRoles = speakers.some((s) => s.role === "rep" && s.role_source === "auto" && (s.role_confidence ?? 1) < 0.6)

  return (
    <section
      aria-label={title}
      className="flex flex-col overflow-hidden rounded-xl border bg-card lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]"
    >
      <div className="space-y-3 border-b p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {speakers.map((s) => (
              <Badge key={s.label} variant="secondary" className="font-normal">
                {speakerName(s.role, s.label)}
                {s.role !== "unknown" && ` = Speaker ${s.label}`}
              </Badge>
            ))}
            {uncertainRoles && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 font-normal text-amber-900">
                Roles uncertain
              </Badge>
            )}
          </div>
        </div>
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={audioSrc}
          className="h-10 w-full"
          onTimeUpdate={(e: { currentTarget: HTMLAudioElement }) => onPlaybackPosition(e.currentTarget.currentTime * 1000)}
          onPause={() => onPlaybackPosition(null)}
          onEnded={() => onPlaybackPosition(null)}
          onError={() => setAudioFailed(true)}
        />
        {audioFailed && <p className="text-xs text-amber-800">The audio couldn't be loaded, but the transcript is still available.</p>}
      </div>

      <div className="max-h-[60vh] min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:max-h-none">
        {utterances.map((u) => (
          <TranscriptLine
            key={u.id}
            u={u}
            markers={markers.get(u.id)}
            isActive={activeId === u.id}
            isPlaying={playingId === u.id}
            registerLine={registerLine}
            onPlay={onPlay}
          />
        ))}
      </div>
    </section>
  )
}
