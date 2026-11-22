/** Client-side upload checks. Same rules and wording as the backend, so users get
 *  instant feedback instead of waiting for a round trip (the server re-checks anyway). */

export const MAX_UPLOAD_MB = 100
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
export const ACCEPTED_EXTENSIONS = [".m4a", ".mp3"] as const

/** For the file picker. Browsers/OSes report m4a under several MIME types, so extensions are listed too. */
export const ACCEPT_ATTR = {
  "audio/mp4": [".m4a"],
  "audio/x-m4a": [".m4a"],
  "audio/m4a": [".m4a"],
  "audio/mpeg": [".mp3"],
  "audio/mp3": [".mp3"],
}

export const MSG_BAD_TYPE = "Unsupported file type. Please upload a .m4a or .mp3 file."
export const MSG_EMPTY = "The selected file is empty."
export const MSG_TOO_LARGE = `File too large (max ${MAX_UPLOAD_MB} MB).`
export const MSG_ONE_FILE = "Please upload one recording at a time."

/** Returns an error message, or null if the file is acceptable. */
export function validateAudioFile(file: { name: string; size: number }): string | null {
  const ext = /\.[^.]+$/.exec(file.name.toLowerCase())?.[0] ?? ""
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) return MSG_BAD_TYPE
  if (file.size === 0) return MSG_EMPTY
  if (file.size > MAX_UPLOAD_BYTES) return MSG_TOO_LARGE
  return null
}

/** Picks the most useful message from react-dropzone's rejection errors. */
export function rejectionMessage(errors: readonly { code: string; message: string }[]): string {
  const codes = errors.map((e) => e.code)
  if (codes.includes("too-many-files")) return MSG_ONE_FILE
  if (codes.includes("invalid-audio")) return errors.find((e) => e.code === "invalid-audio")!.message
  if (codes.includes("file-invalid-type")) return MSG_BAD_TYPE
  if (codes.includes("file-too-large")) return MSG_TOO_LARGE
  return errors[0]?.message ?? "That file can't be used."
}
