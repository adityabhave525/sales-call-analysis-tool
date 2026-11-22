import { useEffect, useState } from "react"

import { parseServerDate } from "@/lib/format"

/** Milliseconds since `startIso`, ticking every second while `running`. */
export function useElapsedMs(startIso: string, running = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])
  return Math.max(0, now - parseServerDate(startIso).getTime())
}
