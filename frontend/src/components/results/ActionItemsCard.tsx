import { Calendar, Copy, ListChecks, User } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatClock } from "@/lib/format"
import {
  ACTION_TYPE_LABEL,
  actionItemsToText,
  deadlineLabel,
  ownerLabel,
} from "@/lib/results"
import { cn } from "@/lib/utils"
import type { AnalysisOut } from "@/types/api"

interface ActionItemsCardProps {
  analysis: AnalysisOut
  filename: string
  onJump: (utteranceId: number | null, startMs: number | null) => void
}

export function ActionItemsCard({ analysis, filename, onJump }: ActionItemsCardProps) {
  const items = analysis.action_items

  async function copy() {
    try {
      await navigator.clipboard.writeText(actionItemsToText(items, filename))
      toast.success("Action items copied")
    } catch {
      toast.error("Couldn't copy. Your browser blocked clipboard access.")
    }
  }

  return (
    <section aria-labelledby="actions-heading" className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
        <h2 id="actions-heading" className="flex items-center gap-2 text-base font-semibold">
          <ListChecks className="size-4 text-muted-foreground" aria-hidden="true" />
          Action items
          <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
        </h2>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={copy}>
            <Copy />
            Copy
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          No action items were found in this call. Only concrete commitments and follow-ups that appear in the transcript are listed.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => {
            const ownerKnown = item.owner_role !== null
            return (
              <li key={item.id} className="space-y-2 p-5">
                <p className="text-sm font-medium leading-snug">{item.description}</p>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {item.item_type && (
                    <Badge variant="secondary" className="font-normal">
                      {ACTION_TYPE_LABEL[item.item_type]}
                    </Badge>
                  )}
                  <Badge variant="outline" className={cn("gap-1 font-normal", !ownerKnown && "text-muted-foreground italic")}>
                    <User className="size-3" aria-hidden="true" />
                    {ownerLabel(item.owner_role)}
                  </Badge>
                  <Badge variant="outline" className={cn("gap-1 font-normal", !item.deadline_text && "text-muted-foreground italic")}>
                    <Calendar className="size-3" aria-hidden="true" />
                    {deadlineLabel(item.deadline_text)}
                  </Badge>
                </div>

                <button
                  type="button"
                  onClick={() => onJump(item.utterance_id, item.start_ms)}
                  className="block w-full rounded-md bg-muted/50 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-label="Jump to this moment in the transcript"
                >
                  “{item.quote}”
                  {item.start_ms != null && <span className="ml-2 text-xs tabular-nums">{formatClock(item.start_ms)}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
