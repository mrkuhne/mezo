// ============================================================
// Mezo · FuelMacroRings — the Fuel Mai hero's macro ring row (Fuel Titanium S1a, mezo-33k6,
// frozen-manifest row A2). Ported from the approved prototype
// docs/design_2.0/prototypes/companion-titanium/fuel-dashboard.js `ring()` (:8) + the
// `/* Macro cells… */` block of fuel-pages.css (:288) — number-only rings, one clay icon per
// cell. The prototype drew the icon BELOW the ring; the owner's decision puts it ABOVE, so the
// icon is the cell's FIRST child and the CSS column order follows the DOM.
//
// Macro identity is the owner's, fixed: fehérje = hús · szénhidrát = gabona · zsír = avokádó ·
// rost = növény · víz = víz. Clay icons only, never emoji.
//
// Honest-null: a ring whose TARGET is unknown carries `is-empty` and shows the VM's own „—"
// instead of a fabricated 0 — the arc stays unfilled rather than reading as "nothing eaten".
//
// Water stays tappable (`onWater`): the retired KeretHero's víz ring was the hub's only
// water-logging door, and S1a must not close it. Without the prop the row is fully passive.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { useSettledArrival } from '@/shared/ui/mozaik/arrival'
import { hu1, huInt } from '@/shared/lib/huNum'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import type { RingVM } from '@/features/fuel/logic/keretHero'

/** Owner-approved macro identity (spec §Owner decisions) — one clay symbol per ring. */
const RING_ICON: Record<RingVM['key'], ClayIconName> = {
  p: 'i-hus',
  c: 'i-gabona',
  f: 'i-avokado',
  fiber: 'i-noveny',
  water: 'i-viz',
}

// jsdom implements a real requestAnimationFrame/setInterval, so an unguarded count-up would
// leave every numeral at 0 for the first frames of a test — the same guard KeretHero.tsx's
// `useCountUpKcal` carries, and for the same reason.
function isJsdomEnv(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
    && navigator.userAgent.includes('jsdom')
}

/** `0 → to` over `durationMs`, cubic ease-out; instant under reduced motion, on a 'pop'
 *  arrival (the number has already been watched once — mezo-kuwj) and in jsdom. The
 *  KeretHero.tsx recipe, kept local to the Titanium hero so neither component can drift. */
export function useFuelCountUp(to: number, durationMs = 950): number {
  const reduced = useReducedMotion()
  const returning = useSettledArrival()
  const skip = reduced || isJsdomEnv() || returning
  const [val, setVal] = useState(skip ? to : 0)
  const shownRef = useRef(skip ? to : 0)

  useEffect(() => {
    if (skip) {
      setVal(to)
      shownRef.current = to
      return
    }
    const from = shownRef.current
    let raf = 0
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = from + (to - from) * eased
      setVal(next)
      shownRef.current = next
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, durationMs, skip])

  return val
}

/** The leading number of a formatted RingVM string ("148 g", "1800 ml", "1,9 l", "—"), and the
 *  unit that follows it. `null` number = the VM had no value to show (honest-null). */
function split(formatted: string): { n: number | null; unit: string; dec: number } {
  const m = /^−?\d+(?:[.,]\d+)?/.exec(formatted.trim())
  if (!m) return { n: null, unit: '', dec: 0 }
  const raw = m[0].replace('−', '-')
  const sep = raw.match(/[.,]/)
  return {
    n: Number(raw.replace(',', '.')),
    unit: formatted.trim().slice(m[0].length).trim(),
    dec: sep ? raw.split(/[.,]/)[1].length : 0,
  }
}

function RingCell({ ring, onWater }: { ring: RingVM; onWater?: () => void }) {
  const value = split(ring.value)
  const target = split(ring.target)
  // Unknown TARGET → no denominator, so no percentage either: the arc stays empty.
  const empty = target.n == null || value.n == null
  const scale = 10 ** value.dec
  const counted = useFuelCountUp(value.n == null ? 0 : Math.round(value.n * scale)) / scale
  const numeral = value.n == null ? '—' : value.dec > 0 ? hu1(counted) : huInt(counted)

  const body = (
    <>
      <span className="fmx-ico" aria-hidden="true">
        <ClayIcon name={RING_ICON[ring.key]} size={29} />
      </span>
      <div
        className={`fmx-ring${empty ? ' is-empty' : ''}`}
        style={{ '--macro-color': ring.color, '--ring-progress': String(empty ? 0 : ring.pct) } as React.CSSProperties}
      >
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle className="fmx-ring-track" cx="40" cy="40" r="34" pathLength={100} />
          <circle className="fmx-ring-progress" cx="40" cy="40" r="34" pathLength={100} />
        </svg>
        {/* ONE sentence for the screen reader; the visual numerals are decoration of it. */}
        <span aria-label={`${ring.label}: ${ring.value} / ${ring.target}`}>
          <strong aria-hidden="true">{numeral}</strong>
          <b aria-hidden="true">/ {target.n == null ? '—' : target.dec > 0 ? hu1(target.n) : huInt(target.n)}{target.unit && <i>{target.unit}</i>}</b>
        </span>
      </div>
    </>
  )

  if (ring.key === 'water' && onWater) {
    return (
      <button type="button" className="fmx-cell" onClick={onWater}
        aria-label={`Víz logolása · ${ring.value} / ${ring.target}`}>
        {body}
      </button>
    )
  }
  return <div className="fmx-cell">{body}</div>
}

export function FuelMacroRings({ rings, onWater }: { rings: RingVM[]; onWater?: () => void }) {
  return (
    <div className="fmx-rings" role="group" aria-label="Makrók, rost és víz">
      {rings.map(r => <RingCell key={r.key} ring={r} onWater={onWater} />)}
    </div>
  )
}
