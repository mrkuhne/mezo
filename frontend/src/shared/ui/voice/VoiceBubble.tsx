// ============================================================
// Mezo · Hallgató Boop — the one feedback surface for every voice input (mezo-zyyox).
//
// Voice input is tap-to-start / tap-to-stop, and after the second tap nothing used to say
// "I'm writing it down" (owner report 2026-09-25). This glass bubble floats above the tab
// bar with the domain's living Boop and walks through the four phases the owner approved in
// `docs/design_2.0/prototypes/hang-boop.html`:
//
//   listening → the Boop, ring and bars pulse with the LIVE mic level (`levelRef`);
//               tapping the bubble stops, ✕ discards the clip
//   thinking  → Boop looks up and sways, an arc spins while the transcript is built
//   done      → a short hop, then the bubble leaves and the text is already in the field
//   sad       → the hook's error sentence, coral accent, hides by itself
//
// It PORTALS into `.phone-screen` (the app frame; `body` in isolation) above sheets, the
// same tier as toasts, so a mic inside a sheet still gets its bubble.
// ============================================================
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { Boop, type BoopDomain } from '@/shared/ui/clay/boop/Boop'
import { cn } from '@/shared/lib/cn'
import '@/shared/ui/voice/VoiceBubble.css'

/** Mirrors `useVoiceInput`'s `VoiceState`; shared/ui must not import from features/. */
type VoiceState = 'unsupported' | 'idle' | 'recording' | 'transcribing'

/** What the bubble reads from `useVoiceInput`. `cancel`/`levelRef` are optional so hook
 *  mocks written before them keep rendering (no ✕, no pulse). */
export interface VoiceBubbleInput {
  state: VoiceState
  error: string | null
  toggle: () => void
  cancel?: () => void
  levelRef?: MutableRefObject<number>
}

type Phase = 'listening' | 'thinking' | 'done' | 'sad'

const DONE_MS = 750
const SAD_MS = 3200
const LEAVE_MS = 360
const BARS = 12

export function VoiceBubble({ voice, domain }: { voice: VoiceBubbleInput; domain: BoopDomain }) {
  const [phase, setPhase] = useState<Phase | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const prev = useRef<{ state: VoiceState; error: string | null }>({ state: 'idle', error: null })
  const timers = useRef<number[]>([])
  const node = useRef<HTMLDivElement>(null)
  const bars = useRef<HTMLSpanElement>(null)
  const [target] = useState(() => document.querySelector('.phone-screen') ?? document.body)

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const leave = () => {
    setLeaving(true)
    later(() => { setPhase(null); setLeaving(false) }, LEAVE_MS)
  }

  // Phase follows the hook's transitions, not just its current value: "idle" means three
  // different things depending on what came before (done, cancelled, failed).
  useEffect(() => {
    const was = prev.current
    prev.current = { state: voice.state, error: voice.error }
    if (voice.state === 'recording') { clearTimers(); setLeaving(false); setPhase('listening'); return }
    if (voice.state === 'transcribing') { clearTimers(); setLeaving(false); setPhase('thinking'); return }
    if (voice.error && voice.error !== was.error) {
      clearTimers(); setLeaving(false); setMessage(voice.error); setPhase('sad')
      later(leave, SAD_MS)
      return
    }
    if (was.state === 'transcribing') {
      clearTimers(); setPhase('done')
      later(leave, DONE_MS)
      return
    }
    if (was.state === 'recording') { clearTimers(); leave() }
  }, [voice.state, voice.error])

  useEffect(() => clearTimers, [])

  // The live level: our own rAF reads the hook's ref and writes CSS, so 60 fps never
  // becomes a React render.
  const levelRef = voice.levelRef
  useEffect(() => {
    if (phase !== 'listening') return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const lvl = levelRef?.current ?? 0
      node.current?.style.setProperty('--lvl', lvl.toFixed(3))
      const s = (now - t0) / 1000
      bars.current?.childNodes.forEach((b, i) => {
        const v = Math.max(0.12, lvl * (0.5 + 0.5 * Math.abs(Math.sin(s * 9 + i * 1.3))))
        ;(b as HTMLElement).style.height = `${(3 + v * 11).toFixed(1)}px`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); node.current?.style.setProperty('--lvl', '0') }
  }, [phase, levelRef])

  if (!phase) return null

  const copy = {
    listening: { k: 'Figyelek', m: 'Mondd nyugodtan', h: 'Koppints ide, ha végeztél' },
    thinking: { k: 'Leírom', m: 'Leírom, amit mondtál…', h: 'Egy pillanat, mindjárt ott lesz' },
    done: { k: 'Kész', m: 'Beírtam', h: 'Nézd át, mielőtt elmented' },
    sad: { k: 'Nem sikerült', m: message ?? '', h: '' },
  }[phase]
  const listening = phase === 'listening'

  return createPortal(
    <div className="vb-slot">
      <div ref={node} className={cn('vb glass is-still', leaving && 'is-leaving')}
        data-phase={phase} data-domain={domain}>
        <button type="button" className="vb-main" disabled={!listening}
          onClick={listening ? voice.toggle : undefined}
          aria-label={listening ? 'Felvétel leállítása' : undefined}>
          <span className="vb-stage" aria-hidden="true">
            <span className="vb-halo" />
            <svg className="vb-ring" viewBox="0 0 68 68">
              <circle className="vb-track" cx="34" cy="34" r="30" />
              <circle className="vb-arc" cx="34" cy="34" r="30" />
            </svg>
            <Boop domain={domain} size={56} alive className="vb-boop" />
          </span>
          <span className="vb-copy" role="status">
            <span className="vb-k">{copy.k}</span>
            <span className="vb-m">{copy.m}</span>
            {copy.h && <span className="vb-h">{copy.h}</span>}
            {listening && (
              <span ref={bars} className="vb-bars" aria-hidden="true">
                {Array.from({ length: BARS }, (_, i) => <i key={i} />)}
              </span>
            )}
          </span>
        </button>
        {listening && voice.cancel && (
          <button type="button" className="vb-x" onClick={voice.cancel}
            aria-label="Mégse, eldobom a felvételt">✕</button>
        )}
      </div>
    </div>,
    target,
  )
}
