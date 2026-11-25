/**
 * The backend stores UTC datetimes but serialises them WITHOUT a timezone
 * ("2026-11-22T10:00:00"). new Date() would read that as LOCAL time and show
 * the wrong hour. Always parse server dates through this.
 */
export function parseServerDate(iso: string): Date {
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso)
  return new Date(hasTimezone ? iso : `${iso}Z`)
}

export function formatDateTime(iso: string): string {
  return parseServerDate(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

/** Transcript timestamps: 0:05, 12:34, 1:02:03 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

/** Call length: "3 min 25 s", "45 s", "1 h 2 min" */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—"
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min ${s} s`
  return `${s} s`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
