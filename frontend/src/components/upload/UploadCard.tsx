import { useCallback, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { useNavigate } from "react-router"

import { Notice } from "@/components/common/Notice"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useUploadJob } from "@/hooks/useJobs"
import { describeError } from "@/lib/errors"
import { getRequestSettings, useSettingsIssues } from "@/store/settingsStore"
import { useUiStore } from "@/store/uiStore"
import { AudioDropzone } from "./AudioDropzone"
import { SelectedFile } from "./SelectedFile"
import { SettingsSummary } from "./SettingsSummary"

export function UploadCard() {
  const navigate = useNavigate()
  const upload = useUploadJob()
  const { reset: resetUpload } = upload
  const issues = useSettingsIssues()
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen)

  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const handleSelect = useCallback(
    (f: File) => {
      setFile(f)
      setFileError(null)
      resetUpload() // a new file clears any previous upload error
    },
    [resetUpload],
  )

  const handleRemove = useCallback(() => {
    setFile(null)
    setFileError(null)
    resetUpload()
  }, [resetUpload])

  function submit() {
    if (!file) return
    upload.mutate(
      { file, settings: getRequestSettings() },
      { onSuccess: (job) => navigate(`/jobs/${job.id}`) },
    )
  }

  const errorMessage = fileError ?? (upload.isError ? describeError(upload.error) : null)
  const blocked = issues.length > 0
  const canSubmit = file !== null && !blocked && !upload.isPending

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        {file ? (
          <SelectedFile file={file} onRemove={handleRemove} disabled={upload.isPending} />
        ) : (
          <AudioDropzone onSelect={handleSelect} onReject={setFileError} disabled={upload.isPending} />
        )}

        {errorMessage && <Notice title={file ? "Upload failed" : "That file can't be used"}>{errorMessage}</Notice>}

        <Separator />
        <SettingsSummary />

        {blocked && (
          <Notice
            title="Fix your settings before analysing"
            action={
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                Open settings
              </Button>
            }
          >
            <ul className="list-disc space-y-0.5 pl-4">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Notice>
        )}

        <Button size="lg" className="w-full" disabled={!canSubmit} onClick={submit}>
          {upload.isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Sparkles />
              Analyse call
            </>
          )}
        </Button>
        {!file && !errorMessage && (
          <p className="text-center text-xs text-muted-foreground">Select a recording to enable analysis.</p>
        )}
      </CardContent>
    </Card>
  )
}
