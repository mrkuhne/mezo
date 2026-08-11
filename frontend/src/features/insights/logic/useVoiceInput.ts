import { useCallback, useEffect, useRef, useState } from 'react'
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
 */
export function useVoiceInput(onTranscript: (text: string) => void) {
  const { transcribe } = useTranscribe()
  const [state, setState] = useState<VoiceState>(() => (isSupported() ? 'idle' : 'unsupported'))
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  // A recording must never outlive the page: an abandoned stream keeps the mic indicator on.
  useEffect(() => () => {
    recorder.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  const finish = useCallback(async (mimeType: string) => {
    setState('transcribing')
    try {
      const raw = new Blob(chunks.current, { type: mimeType || 'audio/webm' })
      chunks.current = []
      if (raw.size < MIN_CLIP_BYTES) {
        setError('Túl rövid felvétel — tartsd nyomva, amíg beszélsz.')
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
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        void finish(rec.mimeType)
      }
      rec.start()
      recorder.current = rec
      setState('recording')
    } catch {
      // Denied permission and "no microphone" are the same story to the user: it can't listen.
      setError('Nem érem el a mikrofont — engedélyezd a böngészőben.')
      setState('idle')
    }
  }, [finish])

  const stop = useCallback(() => recorder.current?.stop(), [])

  const toggle = useCallback(() => {
    if (state === 'recording') stop()
    else if (state === 'idle') void start()
  }, [state, start, stop])

  return { state, error, toggle }
}
