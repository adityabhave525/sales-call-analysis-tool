import { FileAudio, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useObjectUrl } from "@/hooks/useObjectUrl"
import { formatBytes } from "@/lib/format"

interface SelectedFileProps {
  file: File
  onRemove: () => void
  disabled?: boolean
}

export function SelectedFile({ file, onRemove, disabled = false }: SelectedFileProps) {
  const url = useObjectUrl(file)
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileAudio className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Remove file" onClick={onRemove} disabled={disabled}>
          <X />
        </Button>
      </div>
      {/* lets the user confirm it's the right recording before spending an analysis on it */}
      {url && <audio controls preload="metadata" src={url} className="mt-3 h-10 w-full" />}
    </div>
  )
}
