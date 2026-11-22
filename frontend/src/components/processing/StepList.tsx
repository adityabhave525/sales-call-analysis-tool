import { Circle, CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react"

import { PIPELINE_STEPS } from "@/lib/jobs"
import { cn } from "@/lib/utils"

type StepState = "done" | "current" | "pending" | "failed"

interface StepListProps {
  /** index of the running step; PIPELINE_STEPS.length - 1 means everything is done */
  activeIndex: number
  /** set when the job stopped at this step */
  failedIndex?: number
  /** replaces the description of the running step, e.g. "Waiting to start…" */
  currentNote?: string
}

function stateOf(i: number, activeIndex: number, failedIndex?: number): StepState {
  if (failedIndex !== undefined) return i < failedIndex ? "done" : i === failedIndex ? "failed" : "pending"
  return i < activeIndex ? "done" : i === activeIndex ? "current" : "pending"
}

function StepIcon({ state }: { state: StepState }) {
  // red/green are reserved for the tone verdict, so "done" is a neutral dark check
  switch (state) {
    case "done":
      return <CircleCheck className="size-5 text-foreground" />
    case "current":
      return <LoaderCircle className="size-5 animate-spin text-sky-600" />
    case "failed":
      return <TriangleAlert className="size-5 text-amber-600" />
    case "pending":
      return <Circle className="size-5 text-muted-foreground/40" />
  }
}

export function StepList({ activeIndex, failedIndex, currentNote }: StepListProps) {
  return (
    <ol className="space-y-0">
      {PIPELINE_STEPS.map((step, i) => {
        const state = stateOf(i, activeIndex, failedIndex)
        const last = i === PIPELINE_STEPS.length - 1
        return (
          <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0" aria-current={state === "current" ? "step" : undefined}>
            {!last && <span className="absolute left-[9.5px] top-6 bottom-0 w-px bg-border" aria-hidden="true" />}
            <span className="relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center bg-card">
              <StepIcon state={state} />
            </span>
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", state === "pending" && "text-muted-foreground")}>{step.title}</p>
              {(state === "current" || state === "failed") && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {state === "current" && currentNote ? currentNote : step.description}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
