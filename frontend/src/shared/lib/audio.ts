/**
 * Recording-blob → 16 kHz mono WAV (mezo-at8x.4).
 *
 * `MediaRecorder` hands back whatever the engine likes — `audio/webm;codecs=opus` on
 * Chrome/Android, `audio/mp4` (AAC) on iOS Safari — and those two sets barely overlap with
 * what the transcription model reliably accepts. Every browser can, however, DECODE its own
 * recording, so we decode locally and re-encode to the one format that is universally
 * understood: 16-bit PCM WAV. 16 kHz mono is the speech-recognition standard and keeps a
 * two-minute note around 4 MB.
 *
 * The conversion is best-effort: if decoding fails (an engine that won't decode its own
 * container), the caller falls back to uploading the original blob — the backend accepts the
 * common recorder mime types too.
 */

const TARGET_SAMPLE_RATE = 16_000

/** True when this browser can do the decode → resample → encode round trip. */
export function canConvertToWav(): boolean {
  return typeof AudioContext !== 'undefined' && typeof OfflineAudioContext !== 'undefined'
}

export async function blobToWav(blob: Blob): Promise<Blob> {
  const decoded = await decode(await blob.arrayBuffer())
  const mono = await toMono16k(decoded)
  return new Blob([encodeWav(mono)], { type: 'audio/wav' })
}

async function decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(bytes)
  } finally {
    void ctx.close()
  }
}

/** Downmix to one channel and resample to 16 kHz in a single offline render. */
async function toMono16k(buffer: AudioBuffer): Promise<Float32Array> {
  const frames = Math.max(1, Math.ceil((buffer.duration * TARGET_SAMPLE_RATE)))
  const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = buffer
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

/** Minimal 16-bit PCM WAV container — 44-byte canonical header + samples. */
function encodeWav(samples: Float32Array): ArrayBuffer {
  const out = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(out)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header size
  view.setUint16(20, 1, true) // format: PCM
  view.setUint16(22, 1, true) // channels: mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  }
  return out
}
