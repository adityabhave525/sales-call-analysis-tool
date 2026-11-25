import { Mic } from "lucide-react"

import { formatClock } from "@/lib/format"
import { repVoiceLines, strongestFlag } from "@/lib/voice"
import { cn } from "@/lib/utils"
import type { UtteranceOut } from "@/types/api"

interface VoiceTimelineProps {
  utterances: readonly UtteranceOut[]
  durationMs: number | null
  onJump: (utteranceId: number, startMs: number) => void
}

/**
 * The rep's delivery across the call: one bar per line, taller = more energetic,
 * amber when voice flags were raised. Click a bar to jump there.
 * Amber (not red) on purpose: red/green belong to the tone verdict alone.
 */
export function VoiceTimeline({ utterances, durationMs, onJump }: VoiceTimelineProps) {
  const lines = repVoiceLines(utterances)
  if (lines.length === 0) return null
  const total = Math.max(durationMs ?? 0, ...utterances.map((u) => u.end_ms), 1)
  const flagged = lines.filter((u) => (u.voice?.flags.length ?? 0) > 0).length

  return (
    <section aria-labelledby="voice-heading" className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="voice-heading" className="flex items-center gap-2 text-sm font-semibold">
          <Mic className="size-4 text-muted-foreground" aria-hidden="true" />
          Rep's voice over the call
        </h2>
        <span className="text-xs text-muted-foreground">
          {flagged === 0 ? "Nothing unusual heard" : `${flagged} of ${lines.length} lines flagged`}
        </span>
      </div>

      <div className="relative h-16 rounded-md bg-muted/60" role="list" aria-label="Rep's lines by time">
        {lines.map((u) => {
          const v = u.voice!
          const flag = strongestFlag(v.flags)
          const height = Math.round(18 + 82 * Math.min(1, Math.max(0, v.arousal ?? 0.25)))
          const left = (u.start_ms / total) * 100
          const width = Math.max(0.9, ((u.end_ms - u.start_ms) / total) * 100)
          return (
            <button
              key={u.id}
              type="button"
              role="listitem"
              onClick={() => onJump(u.id, u.start_ms)}
              title={`${formatClock(u.start_ms)}${flag ? `: ${v.flags.map((f) => f.label).join(", ")}` : ""}`}
              aria-label={`Jump to ${formatClock(u.start_ms)}${flag ? `, ${flag.label}` : ""}`}
              className={cn(
                "absolute bottom-0 rounded-t-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-1",
                flag ? (flag.strength === "high" ? "bg-orange-600" : "bg-amber-500") : "bg-stone-300",
              )}
              style={{ left: `${left}%`, width: `${width}%`, height: `${height}%` }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>0:00</span>
        <span>{formatClock(total)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Bar height is vocal energy. Highlighted bars are lines where the voice sounded angry, raised or unusually agitated for this speaker.
      </p>
    </section>
  )
}
