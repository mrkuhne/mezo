import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useTranscribe } from '@/data/hooks'
import { blobToWav, canConvertToWav } from '@/shared/lib/audio'

export type VoiceState = 'unsupported' | 'idle' | 'recording' | 'transcribing'

/** Anything this short was a mis-tap, not a sentence. */
const MIN_CLIP_BYTES = 512

const isSupported = () =>
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function' &&
  typeof MediaRecorder !== 'undefined'

/**
 * Push-to-talk for the chat composer (mezo-at8x.4): record → convert → transcribe → hand the
 * text to the caller, which drops it in the input for the user to check before sending.
 *
 * The transcription itself is server-side ([`useTranscribe`](@/data/hooks)) rather than the
 * browser's Web Speech API, because Web Speech is missing or unreliable in exactly this app's
 * habitat — iOS Safari and installed PWAs. `MediaRecorder` + `getUserMedia` work everywhere.
 *
 * Hallgató Boop (mezo-zyyox): `levelRef` is the live mic loudness (0..1) for the listening
 * bubble. It is a ref, not state, so a 60 fps signal never re-renders the consumer, and it
 * stays 0 wherever Web Audio is missing. `cancel()` stops the recording and throws the clip
 * away, so nothing is transcribed.
 */
export function useVoiceInput(onTranscript: (text: string) => void): {
  state: VoiceState
  error: string | null
  toggle: () => void
  cancel: () => void
  levelRef: MutableRefObject<number>
} {
  const { transcribe } = useTranscribe()
  const [state, setState] = useState<VoiceState>(() => (isSupported() ? 'idle' : 'unsupported'))
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const cancelled = useRef(false)
  const levelRef = useRef(0)
  const meter = useRef<{ ctx: AudioContext; raf: number } | null>(null)

  const stopMeter = useCallback(() => {
    if (meter.current) {
      cancelAnimationFrame(meter.current.raf)
      void meter.current.ctx.close().catch(() => {})
      meter.current = null
    }
    levelRef.current = 0
  }, [])

  // Loudness for the bubble: RMS of the time-domain signal, eased so it breathes, not jitters.
  const startMeter = useCallback((stream: MediaStream) => {
    const Ctx = typeof AudioContext === 'function' ? AudioContext : undefined
    if (!Ctx) return
    try {
      const ctx = new Ctx()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += ((v - 128) / 128) ** 2
        const target = Math.min(1, Math.sqrt(sum / buf.length) * 4)
        levelRef.current += (target - levelRef.current) * 0.3
        if (meter.current) meter.current.raf = requestAnimationFrame(tick)
      }
      meter.current = { ctx, raf: requestAnimationFrame(tick) }
    } catch {
      // No meter is fine: the bubble still listens, it just doesn't pulse.
    }
  }, [])

  // A recording must never outlive the page: an abandoned stream keeps the mic indicator on.
  useEffect(() => () => {
    recorder.current?.stream.getTracks().forEach((t) => t.stop())
    stopMeter()
  }, [stopMeter])

  const finish = useCallback(async (mimeType: string) => {
    setState('transcribing')
    try {
      const raw = new Blob(chunks.current, { type: mimeType || 'audio/webm' })
      chunks.current = []
      if (raw.size < MIN_CLIP_BYTES) {
        setError('Túl rövid volt — koppints, beszélj, aztán koppints újra.')
        return
      }
      // Every engine can decode its OWN recording, so the wav round trip is what makes the
      // upload format uniform; if it fails, the original blob is still an accepted mime type.
      const upload = canConvertToWav() ? await blobToWav(raw).catch(() => raw) : raw
      const text = (await transcribe(upload)).trim()
      if (text) onTranscript(text)
      else setError('Nem hallottam semmit — próbáld újra.')
    } catch {
      setError('A leiratozás nem sikerült — próbáld újra.')
    } finally {
      setState('idle')
    }
  }, [onTranscript, transcribe])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunks.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      cancelled.current = false
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        stopMeter()
        if (cancelled.current) {
          chunks.current = []
          setState('idle')
          return
        }
        void finish(rec.mimeType)
      }
      rec.start()
      recorder.current = rec
      startMeter(stream)
      setState('recording')
    } catch {
      // Denied permission and "no microphone" are the same story to the user: it can't listen.
      setError('Nem érem el a mikrofont — engedélyezd a böngészőben.')
      setState('idle')
    }
  }, [finish, startMeter, stopMeter])

  const stop = useCallback(() => recorder.current?.stop(), [])

  const toggle = useCallback(() => {
    if (state === 'recording') stop()
    else if (state === 'idle') void start()
  }, [state, start, stop])

  const cancel = useCallback(() => {
    if (recorder.current?.state === 'inactive') return
    cancelled.current = true
    recorder.current?.stop()
  }, [])

  return { state, error, toggle, cancel, levelRef }
}
