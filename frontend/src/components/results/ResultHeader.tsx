import type { ReactNode } from "react"
import { ArrowLeft, Bot, Calendar, Languages, Timer } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { formatDateTime, formatDuration } from "@/lib/format"
import { languageName } from "@/lib/results"
import { MODEL_OPTIONS } from "@/lib/settings"
import type { AnalysisOut, JobOut } from "@/types/api"

function Meta({ icon: Icon, children }: { icon: typeof Timer; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </li>
  )
}

interface ResultHeaderProps {
  job: JobOut
  analysis: AnalysisOut
  languageCode: string | null
}

export function ResultHeader({ job, analysis, languageCode }: ResultHeaderProps) {
  const model = MODEL_OPTIONS.find((m) => m.value === analysis.llm_model)?.label ?? analysis.llm_model
  const language = languageName(languageCode)

  return (
    <header className="space-y-2">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/">
          <ArrowLeft />
          All analyses
        </Link>
      </Button>
      <h1 className="truncate text-2xl font-semibold tracking-tight" title={job.original_filename}>
        {job.original_filename}
      </h1>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <Meta icon={Calendar}>{formatDateTime(analysis.completed_at ?? analysis.created_at)}</Meta>
        <Meta icon={Timer}>{formatDuration(job.duration_ms)}</Meta>
        {language && <Meta icon={Languages}>{language}</Meta>}
        <Meta icon={Bot}>
          {model} · analysis v{analysis.version}
        </Meta>
      </ul>
    </header>
  )
}
