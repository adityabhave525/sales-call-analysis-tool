import { useQuery } from "@tanstack/react-query"

import { api, API_BASE, USE_MOCK } from "@/api"
import { Notice } from "@/components/common/Notice"

/** Tells the user up front if the backend is down or missing API keys, instead of failing mysteriously later. */
export function BackendStatus() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api.health(),
    retry: false,
    refetchInterval: (query) => (query.state.data ? false : 5000), // keep checking until it's up
  })

  if (USE_MOCK) return null

  if (health.isError) {
    return (
      <Notice title="Can't reach the backend" className="mb-6">
        Nothing is answering at <code className="rounded bg-amber-100 px-1">{API_BASE}</code>. Start it from the backend folder
        with <code className="rounded bg-amber-100 px-1">uvicorn app.main:app --reload --port 8000</code>. This page rechecks
        every few seconds.
      </Notice>
    )
  }

  const missing = health.data
    ? [
        !health.data.assemblyai_key_set && "ASSEMBLYAI_API_KEY",
        !health.data.anthropic_key_set && "ANTHROPIC_API_KEY",
      ].filter(Boolean)
    : []
  if (missing.length > 0) {
    return (
      <Notice title="API key missing" className="mb-6">
        The backend doesn't have {missing.join(" and ")} set, so analyses will fail. Add it to <code className="rounded bg-amber-100 px-1">backend/.env</code> and restart the backend.
      </Notice>
    )
  }
  return null
}
