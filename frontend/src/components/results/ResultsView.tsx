import { useMemo } from "react"

import { api } from "@/api"
import { useTranscriptInteraction } from "@/hooks/useTranscriptInteraction"
import { buildMarkers } from "@/lib/results"
import type { AnalysisOut, JobResultOut } from "@/types/api"
import { ActionItemsCard } from "./ActionItemsCard"
import { ResultHeader } from "./ResultHeader"
import { SummaryCard } from "./SummaryCard"
import { ToneCard } from "./ToneCard"
import { TranscriptPanel } from "./TranscriptPanel"

interface ResultsViewProps {
  result: JobResultOut
  analysis: AnalysisOut
}

export function ResultsView({ result, analysis }: ResultsViewProps) {
  const { job, utterances, speakers, language_code } = result
  const markers = useMemo(() => buildMarkers(analysis), [analysis])
  const interaction = useTranscriptInteraction(utterances)
  const audioSrc = useMemo(() => api.audioUrl(job.id), [job.id])

  return (
    <div className="space-y-6">
      <ResultHeader job={job} analysis={analysis} languageCode={language_code} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          <ToneCard analysis={analysis} onJump={interaction.jumpTo} />
          <ActionItemsCard analysis={analysis} filename={job.original_filename} onJump={interaction.jumpTo} />
          <SummaryCard summary={analysis.call_summary} />
        </div>

        <TranscriptPanel
          utterances={utterances}
          speakers={speakers}
          markers={markers}
          audioSrc={audioSrc}
          interaction={interaction}
        />
      </div>
    </div>
  )
}
