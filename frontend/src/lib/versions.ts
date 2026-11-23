import type { VersionOut } from "@/types/api"

/** Highest version number whose analysis completed (that is what "latest" means). */
export function latestCompletedVersion(versions: readonly VersionOut[]): number | null {
  const done = versions.filter((v) => v.status === "completed").map((v) => v.version)
  return done.length ? Math.max(...done) : null
}

/** "?v=2" -> 2. Anything that isn't a positive integer means "latest". */
export function parseVersionParam(raw: string | null): number | undefined {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return undefined
  return Number(raw)
}
