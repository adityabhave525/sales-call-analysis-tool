import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api"
import { isJobBusy, POLL_INTERVAL_MS } from "@/lib/jobs"
import type { AnalysisSettings } from "@/types/api"

export const jobKeys = {
  list: ["jobs", "list"] as const,
  detail: (id: string) => ["jobs", "detail", id] as const,
  result: (id: string, version?: number) => ["jobs", "result", id, version ?? "latest"] as const,
}

/** Recent analyses. Polls only while at least one job is still processing. */
export function useJobs() {
  return useQuery({
    queryKey: jobKeys.list,
    queryFn: () => api.listJobs(),
    refetchInterval: (query) =>
      query.state.data?.some((j) => isJobBusy(j.status)) ? POLL_INTERVAL_MS : false,
  })
}

/** One job's status. This is the polling loop behind the processing screen. */
export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: () => api.getJob(id),
    enabled: id !== "",
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && isJobBusy(status) ? POLL_INTERVAL_MS : false
    },
  })
}

/** Full result (transcript, tone, evidence, action items). Fetch only once the job is done. */
export function useResult(id: string, enabled: boolean, version?: number) {
  return useQuery({
    queryKey: jobKeys.result(id, version),
    queryFn: () => api.getResult(id, version),
    enabled: enabled && id !== "",
  })
}

export function useUploadJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, settings }: { file: File; settings: AnalysisSettings }) =>
      api.uploadJob(file, settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobKeys.list }),
  })
}

/** Re-run only the analysis step (no re-transcription). Used for "Retry analysis"; the settings drawer reuses it. */
export function useReanalyse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: AnalysisSettings }) => api.reanalyse(id, settings),
    onSuccess: (_job, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: jobKeys.detail(id) }), // status is "analysing" again => polling resumes
        qc.invalidateQueries({ queryKey: ["jobs", "result", id] }),
        qc.invalidateQueries({ queryKey: jobKeys.list }),
      ]),
  })
}

/** "Swap roles": sets who the rep is. Applies to the NEXT analysis, so callers usually offer a re-analyse. */
export function useAssignRep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, repLabel }: { id: string; repLabel: string }) => api.assignRep(id, repLabel),
    onSuccess: (_speakers, { id }) => qc.invalidateQueries({ queryKey: ["jobs", "result", id] }),
  })
}

export function useDeleteJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobKeys.list }),
  })
}
