import { AudioLines, BookCheck, Info, Quote, ShieldAlert, ShieldCheck } from "lucide-react"

import { Notice } from "@/components/common/Notice"
import { Badge } from "@/components/ui/badge"
import { formatClock, formatPercent } from "@/lib/format"
import { criterionLabel, SEVERITY_LABEL, toneHeadline } from "@/lib/results"
import { BASIS_HELP, BASIS_LABEL } from "@/lib/voice"
import { cn } from "@/lib/utils"
import type { AnalysisOut, Tone } from "@/types/api"

/** Red and green appear ONLY here (and on the history dots later): they always mean the tone verdict. */
const TONE_STYLE: Record<Tone, { banner: string; pill: string; icon: string }> = {
  RED: { banner: "border-red-200 bg-red-50 text-red-950", pill: "bg-red-600 text-white", icon: "text-red-600" },
  GREEN: { banner: "border-emerald-200 bg-emerald-50 text-emerald-950", pill: "bg-emerald-600 text-white", icon: "text-emerald-600" },
}

interface ToneCardProps {
  analysis: AnalysisOut
  onJump: (utteranceId: number | null, startMs: number | null) => void
}

export function ToneCard({ analysis, onJump }: ToneCardProps) {
  const { tone, tone_confidence, needs_review, tone_explanation, tone_evidence, warnings } = analysis
  const style = tone ? TONE_STYLE[tone] : null
  const Icon = tone === "RED" ? ShieldAlert : tone === "GREEN" ? ShieldCheck : Info
  const counted = tone_evidence.filter((ev) => !ev.dismissed_by_rule)
  const dismissed = tone_evidence.filter((ev) => ev.dismissed_by_rule)

  const renderEvidence = (ev: AnalysisOut["tone_evidence"][number]) => (
      <li key={ev.id}>
        <button
          type="button"
          onClick={() => onJump(ev.utterance_id, ev.start_ms)}
          className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={`Jump to this quote in the transcript${ev.start_ms != null ? ` at ${formatClock(ev.start_ms)}` : ""}`}
        >
          <div className="flex gap-2">
            <Quote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium leading-relaxed">“{ev.quote}”</p>
          </div>
          {ev.explanation && <p className="mt-1.5 pl-6 text-sm text-muted-foreground">{ev.explanation}</p>}
          {ev.dismissed_by_rule && (
            <p className="mt-1.5 flex items-start gap-1.5 pl-6 text-xs text-slate-700">
              <BookCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Dismissed by your rule: <span className="font-medium">{ev.dismissed_by_rule}</span>
              </span>
            </p>
          )}
          {ev.voice_cues && ev.voice_cues.length > 0 && (
            <p className="mt-1.5 flex items-center gap-1.5 pl-6 text-xs text-orange-900">
              <AudioLines className="size-3.5 shrink-0" aria-hidden="true" />
              Heard in the voice: {ev.voice_cues.join(", ")}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
            {ev.basis && (
              <Badge
                variant="outline"
                title={BASIS_HELP[ev.basis]}
                className={cn(
                  "font-normal",
                  ev.basis !== "words" && "border-orange-200 bg-orange-50 text-orange-900",
                )}
              >
                {BASIS_LABEL[ev.basis]}
              </Badge>
            )}
            <Badge variant="secondary" className="font-normal">
              {criterionLabel(analysis, ev.criterion)}
            </Badge>
            <Badge
              variant="outline"
              className={cn("font-normal", ev.dismissed_by_rule && ev.severity === "high" && "border-amber-300 bg-amber-100 text-amber-950")}
              title={ev.dismissed_by_rule && ev.severity === "high" ? "Serious behaviour that your rule excused. Worth a second look." : undefined}
            >
              {SEVERITY_LABEL[ev.severity]}
              {ev.dismissed_by_rule && ev.severity === "high" ? " · dismissed anyway" : ""}
            </Badge>
            {ev.start_ms != null && (
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {formatClock(ev.start_ms)} · jump to line
              </span>
            )}
          </div>
        </button>
      </li>
  )

  return (
    <section aria-labelledby="tone-heading" className="overflow-hidden rounded-xl border bg-card">
      <div className={cn("flex items-start gap-4 border-b p-5", style?.banner ?? "bg-muted")}>
        <Icon className={cn("size-9 shrink-0", style?.icon ?? "text-muted-foreground")} aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {tone && <span className={cn("rounded-md px-2.5 py-1 text-sm font-bold tracking-wide", style?.pill)}>{tone}</span>}
            <h2 id="tone-heading" className="text-lg font-semibold">
              {tone ? toneHeadline(tone) : "Tone unavailable"}
            </h2>
          </div>
          <p className="text-sm opacity-80">
            Sales rep's tone · {tone_confidence != null ? `${formatPercent(tone_confidence)} confidence` : "confidence unavailable"}
          </p>
        </div>
        {needs_review && (
          <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-100 text-amber-950">
            Needs review
          </Badge>
        )}
      </div>

      <div className="space-y-5 p-5">
        {tone_explanation && <p className="text-sm leading-relaxed">{tone_explanation}</p>}

        {needs_review && (
          <Notice title="Worth double-checking">
            {warnings.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : (
              "Confidence is low, so treat this as a hint rather than a verdict."
            )}
          </Notice>
        )}
        {!needs_review && warnings.length > 0 && (
          <Notice variant="info" title="Notes">
            <ul className="list-disc space-y-1 pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Notice>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            {counted.length === 0
              ? "Evidence"
              : tone === "RED"
                ? `Supporting evidence (${counted.length})`
                : `Possible concerns, not enough to flag RED (${counted.length})`}
          </h3>

          {counted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tone === "GREEN" ? "No quotes from the rep showed negative tone." : "No supporting quotes were verified."}
            </p>
          ) : (
            <ul className="space-y-2">
              {counted.map((ev) => renderEvidence(ev))}
            </ul>
          )}
        </div>

        {dismissed.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Dismissed by your rules ({dismissed.length})</h3>
            <p className="text-xs text-muted-foreground">
              These would normally count as negative, but one of your rules says they are fine. They did not affect the verdict.
            </p>
            <ul className="space-y-2">{dismissed.map((ev) => renderEvidence(ev))}</ul>
          </div>
        )}
      </div>
    </section>
  )
}
