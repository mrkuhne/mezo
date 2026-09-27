import type { CSSProperties } from 'react'
import type { ReadinessTodayResponse } from '@/data/train/readinessApi'
import { useTodayReadiness } from '@/data/hooks'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'

// ============================================================
// Check-in 2.0 · „Mai állapot" (mezo-ck2, spec 2026-09-27 §3.3) — the Edzés today card built to
// the approved prototype (`elo/edzes.html` `readyCard()`): this morning's check-in says a lighter
// day would be wiser. Lavender glass offer (eyebrow, title, reason chips with 3D icons, the rose
// care row per pain-loaded exercise, a lit „Könnyítsük" pill + a ghost „Maradjon a terv", the
// „Csak javaslat" note); after „Könnyítsük" a sage glass „Könnyítve" state with the undo ghost.
// „Maradjon a terv" hides it for the day. Never automatic — nothing changes without a tap.
// ============================================================

const REASON: Record<ReadinessTodayResponse['reasons'][number]['item'], { icon: Icon3DName; label: string }> = {
  rested: { icon: 't-rested', label: 'Kipihentség' },
  soreness: { icon: 't-soreness', label: 'Izomláz' },
  motivation: { icon: 't-motivation', label: 'Kedv' },
}

const TOAST = {
  lighten: 'Könnyítve — ma egy fokkal lejjebb',
  keep: 'Rendben, marad a terv',
  undo: 'Visszaállítva az eredeti terv',
} as const

/** Hungarian definite article: „az" before a vowel sound, else „a" (capitalised, sentence-initial). */
function article(word: string): string {
  return /^[aáeéiíoóöőuúüű]/i.test(word) ? 'Az' : 'A'
}

/** „X", „X és Y", „X, Y és Z". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} és ${names[names.length - 1]}`
}

/** Presentational card — the readiness in, the three taps out. Renders nothing for NONE / KEPT. */
export function ReadinessCard({ readiness, onLighten, onKeep, onUndo, busy = false }: {
  readiness: ReadinessTodayResponse
  onLighten: () => void
  onKeep: () => void
  onUndo: () => void
  busy?: boolean
}) {
  const { state, reasons, care } = readiness
  if (state === 'LIGHTENED') {
    const names = care.map((c) => c.exerciseName)
    return (
      <section className="trd glass is-lightened" style={{ '--c': 'var(--dv-sage)' } as CSSProperties}
        aria-label="Mai állapot">
        <span className="trd-eb">MAI ÁLLAPOT · KÖNNYÍTVE</span>
        <h3 className="trd-title">Ma egy fokkal lejjebb</h3>
        <div className="trd-ok">
          <Icon3D name="t-tick" size={20} />
          <span>
            Minden gyakorlatnál a múlt heti súly marad, nem emelünk.
            {names.length > 0 && ` ${article(names[0])} ${joinNames(names)} nehéz szettjei kimaradnak.`}
          </span>
        </div>
        <div className="trd-acts">
          <button type="button" className="trd-pill is-ghost np-press" onClick={onUndo} disabled={busy}>
            Visszaállítom a tervet
          </button>
        </div>
      </section>
    )
  }
  if (state !== 'OFFER') return null
  return (
    <section className="trd glass" style={{ '--c': 'var(--dv-lav)' } as CSSProperties} aria-label="Mai állapot">
      <span className="trd-eb">MAI ÁLLAPOT · A REGGELI CHECK-INBŐL</span>
      <h3 className="trd-title">Könnyebb nap javasolt</h3>
      {reasons.length > 0 && (
        <div className="trd-why">
          {reasons.map((r) => (
            <span key={r.item} className="trd-chip">
              <Icon3D name={REASON[r.item].icon} size={18} />
              {REASON[r.item].label} {r.value}/10
            </span>
          ))}
        </div>
      )}
      {care.map((c) => (
        <div key={c.exerciseName} className="trd-care">
          <Icon3D name="t-pain" size={28} />
          <span>
            <b>{c.exerciseName}</b> — fáj a {c.regionLabel}{c.intensity != null && ` (${c.intensity}/10)`}.
            {' '}Ma óvatosan: könnyebb súly, vagy hagyd ki.
          </span>
        </div>
      ))}
      <div className="trd-acts">
        <button type="button" className="trd-pill np-press" onClick={onLighten} disabled={busy}>Könnyítsük</button>
        <button type="button" className="trd-pill is-ghost np-press" onClick={onKeep} disabled={busy}>
          Maradjon a terv
        </button>
      </div>
      <p className="trd-note">Csak javaslat — magától nem változtat semmit.</p>
    </section>
  )
}

/**
 * The wired card for the Edzés today page: reads today's readiness, stores the tap, confirms it
 * with the prototype's toast. Hidden once today's workout is done (`done`) and whenever there is
 * nothing to offer.
 */
export function TodayReadiness({ done }: { done: boolean }) {
  const { readiness, choose, undo, saving } = useTodayReadiness()
  const toast = useToast()
  if (done) return null
  if (readiness.state !== 'OFFER' && readiness.state !== 'LIGHTENED') return null
  return (
    <ReadinessCard
      readiness={readiness}
      busy={saving}
      onLighten={() => choose('LIGHTEN', () => toast.show({ kind: 'success', text: TOAST.lighten }))}
      onKeep={() => choose('KEEP', () => toast.show({ kind: 'info', text: TOAST.keep }))}
      onUndo={() => undo(() => toast.show({ kind: 'info', text: TOAST.undo }))}
    />
  )
}
