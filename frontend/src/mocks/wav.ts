/**
 * A silent WAV of the right length, so the audio player and click-to-seek can be
 * built and tested in mock mode. 8 kHz, 8-bit, mono: about 8 KB per second.
 */
export function makeSilentWav(durationMs: number): Uint8Array {
  const sampleRate = 8000
  const samples = Math.max(1, Math.round((durationMs / 1000) * sampleRate))
  const buf = new Uint8Array(44 + samples)
  const view = new DataView(buf.buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) buf[offset + i] = text.charCodeAt(i)
  }
  ascii(0, "RIFF")
  view.setUint32(4, 36 + samples, true)
  ascii(8, "WAVE")
  ascii(12, "fmt ")
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true) // byte rate (1 byte per sample)
  view.setUint16(32, 1, true) // block align
  view.setUint16(34, 8, true) // bits per sample
  ascii(36, "data")
  view.setUint32(40, samples, true)
  buf.fill(128, 44) // 8-bit PCM silence is 128, not 0
  return buf
}

export function makeSilentWavUrl(durationMs: number): string {
  const bytes = makeSilentWav(durationMs)
  return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" }))
}
