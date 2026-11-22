import { useCallback } from "react"
import { UploadCloud } from "lucide-react"
import { useDropzone, type FileRejection } from "react-dropzone"

import { cn } from "@/lib/utils"
import { ACCEPT_ATTR, MAX_UPLOAD_MB, rejectionMessage, validateAudioFile } from "@/lib/upload"

interface AudioDropzoneProps {
  onSelect: (file: File) => void
  onReject: (message: string) => void
  disabled?: boolean
}

export function AudioDropzone({ onSelect, onReject, disabled = false }: AudioDropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        onReject(rejectionMessage(rejected.flatMap((r) => r.errors)))
        return
      }
      if (accepted[0]) onSelect(accepted[0])
    },
    [onSelect, onReject],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT_ATTR,
    multiple: false,
    disabled,
    // our own rules (type, empty, size) with the same wording the backend uses
    validator: (file) => {
      const message = validateAudioFile(file)
      return message ? { code: "invalid-audio", message } : null
    },
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        isDragActive ? "border-foreground/60 bg-muted" : "border-border hover:border-foreground/40 hover:bg-muted/50",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input {...getInputProps()} aria-label="Upload a call recording" />
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <UploadCloud className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">
          {isDragActive ? "Drop the recording to select it" : "Drag and drop a call recording"}
        </p>
        <p className="text-sm text-muted-foreground">
          or <span className="font-medium text-foreground underline underline-offset-4">browse files</span>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">.m4a or .mp3 · up to {MAX_UPLOAD_MB} MB · one call at a time</p>
    </div>
  )
}
