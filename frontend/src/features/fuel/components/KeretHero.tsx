// ============================================================
// Mezo · KeretHero — the Fuel Mai hero (mezo-c9t5, keret-hero Task 2). Sits at the top of
// the page, above the window-river sky, replacing the retired KeretBelt. Anatomy top→bottom:
// a 2s ease-out count-up of TODAY'S CONSUMED kcal on a halo-sage band (hub v3 declutter,
// fuel iterations §2 — the "eddig X / Y · n/m ablak" of-line is gone: the frame is told by
// the chips and the day-bar), a segmented day-bar with a gold now-marker, the 3 signed
// energy chips (→ EnergyBreakdownSheet sections), and the 5 macro/rost/víz progress rings
// (the víz ring is a real button opening the water-log sheet). Pure presentational: all data
// comes from the `KeretHeroVM` Task 1 built; every callback is a prop, no data hooks here.
// Count-up: a local fork of shared/ui/CountUp's rAF+reduced-motion hook (HU-grouped display
// needs an intermediate value CountUp itself doesn't expose, and the jsdom short-circuit
// there is deliberately shared — a dangling rAF surviving test teardown is the same
// "window is not defined" flake class Sheet.tsx's exit-timer comment documents).
// Ring fill is a pure CSS `stroke-dashoffset` transition, not JS-driven: `filled` starts
// false (or true under reduced motion) and flips true one frame after mount, so the CSS
// transition (`.khero-ring-fill` in prototype.css) does the animating — no per-frame ring
// math needed. Design: docs/superpowers/specs/2026-08-09-fuel-keret-hero-design.md §1.2,
// mockup docs/superpowers/specs/assets/2026-08-09-fuel-keret-hero-mockup.html.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { hu1, huInt } from '@/shared/lib/huNum'
import type { EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import type { KeretHeroVM, RingVM } from '@/features/fuel/logic/keretHero'

// HU thousands grouping (shared/lib/huNum's `huInt`, the KeretBelt.tsx precedent) for the same
// 4-digit kcal values. Unicode minus (U+2212), never the ASCII hyphen.
const MINUS = '−'
const fmt = huInt
const signed = (n: number) => `${n < 0 ? MINUS : '+'}${fmt(Math.abs(n))}`

// The víz ring's RingVM carries raw ml (Task 1's data, e.g. "1200 ml") — the mockup's
// validated presentation is liters with one HU decimal ("1,2"), both on-ring and in the
// button's aria-label. Presentation-only: parses the ml back out of the formatted string
// rather than changing RingVM (Task 3 imports that shape sight-unseen).
const litersOf = (mlLabel: string) => hu1(parseFloat(mlLabel) / 1000)

// jsdom implements a real requestAnimationFrame — see shared/ui/CountUp.tsx's identical guard.
function isJsdomEnv(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
    && navigator.userAgent.includes('jsdom')
}

/** `prev` → `to` over `durationMs`, cubic ease-out, skipped (instant final value, no rAF) under
 *  reduced motion or jsdom. Local fork of shared/ui/CountUp's hook — this one returns the
 *  raw number so the caller can HU-format it (CountUp renders plain unformatted digits).
 *  `prev` is the last value this hook actually displayed (kept in a ref, not state — it must
 *  survive across the `to` change without itself triggering a render): first mount animates
 *  0→to same as before, but a LATER `to` change (e.g. a fresh water/meal log while the hero is
 *  already on screen) animates from wherever the sweep last landed, never restarts at 0 — a
 *  restart would flash the number down through the whole 0..to range on every small update. */
function useCountUpKcal(to: number, durationMs = 2000): number {
  const reduced = useReducedMotion()
  const skip = reduced || isJsdomEnv()
  const [val, setVal] = useState(skip ? to : 0)
  const displayedRef = useRef(skip ? to : 0)

  useEffect(() => {
    if (skip) {
      setVal(to)
      displayedRef.current = to
      return
    }
    const from = displayedRef.current
    let raf = 0
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = Math.round(from + (to - from) * eased)
      setVal(next)
      displayedRef.current = next
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, durationMs, skip])

  return val
}

const RING_SIZE = 58
const RING_STROKE = 5
const RING_R = RING_SIZE / 2 - RING_STROKE
const RING_C = 2 * Math.PI * RING_R

// Shared inner markup for a ring — the SVG, the centered %, the label + value/target below.
// The caller supplies the outer element (a progressbar `div` for the 4 macro/rost rings, a
// real `button` for víz) so this stays semantics-free. `gv`/`gvTarget` let the víz ring
// override the raw-ml RingVM value/target with the liter presentation (see `litersOf`).
function RingBody({ ring, filled, gv, gvTarget }: { ring: RingVM; filled: boolean; gv?: string; gvTarget?: string }) {
  const frac = Math.max(0, Math.min(1, ring.pct / 100))
  const offset = filled ? RING_C - frac * RING_C : RING_C
  return (
    <>
      <div className="khero-ringwrap">
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
          <circle className="khero-ring-track" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none" strokeWidth={RING_STROKE} />
          <circle className="khero-ring-fill" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none"
            stroke={ring.color} strokeWidth={RING_STROKE} strokeLinecap="round"
            strokeDasharray={RING_C} strokeDashoffset={offset} />
        </svg>
        <span className="khero-pctv" aria-hidden="true">{ring.pct}<em>%</em></span>
      </div>
      <div className="khero-lb" style={{ color: ring.color }}>{ring.label}</div>
      <div className="khero-gv">{gv ?? ring.value} <em>/ {gvTarget ?? ring.target}</em></div>
    </>
  )
}

export function KeretHero({ vm, onChip, onWaterRing, durationMs = 2000, ofLine }: {
  vm: KeretHeroVM
  onChip: (section: EnergySection) => void
  onWaterRing: () => void
  /** Count-up duration in ms — test-only override (the CountUp.tsx precedent); default 2000. */
  durationMs?: number
  /** Optional line under the number — the /fuel/log page's "n/m ablak kész · x kcal még belefér"
   *  (mezo-zeeq). The hub passes nothing and keeps its v3 declutter (no of-line at all). */
  ofLine?: string
}) {
  const reduced = useReducedMotion()
  // Hub v3 declutter (fuel iterations §2, Daniel: "nem kell az eddig x/y kalória, csak
  // amennyit elfogyasztott"): the hero is ONE number — the kcal CONSUMED today.
  const displayKcal = useCountUpKcal(vm.consumedKcal, durationMs)

  // Rings fill together with the count-up: starts empty (or already final under reduced
  // motion), flips true one frame after mount so the CSS transition carries the sweep.
  const [filled, setFilled] = useState(reduced)
  useEffect(() => {
    if (reduced) return
    const raf = requestAnimationFrame(() => setFilled(true))
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  return (
    <div className="khero">
      <div className="khero-n" aria-label={`${fmt(vm.consumedKcal)} kcal ma`}>
        {fmt(displayKcal)}
        <span className="khero-u"> kcal ma</span>
      </div>
      {ofLine && <div className="khero-of">{ofLine}</div>}
      <div className="khero-dayseg">
        {vm.segments.map((s, i) => (
          <i key={i} className={s.toneAlt ? 'khero-seg khero-seg-alt' : 'khero-seg'} style={{ width: `${s.widthPct}%` }} />
        ))}
        {vm.nowFrac != null && <span className="khero-mark" style={{ left: `${vm.nowFrac * 100}%` }} />}
      </div>
      {vm.chips && (
        <div className="khero-chips">
          <button type="button" className="khero-chip" onClick={() => onChip('base')}>
            Alap <b>{fmt(vm.chips.base)}</b>
          </button>
          <button type="button" className="khero-chip" onClick={() => onChip('movement')}>
            Mozgás <b>+{fmt(vm.chips.activity)}</b>
          </button>
          <button type="button" className="khero-chip khero-chip-goal" onClick={() => onChip('deficit')}>
            Cél <b>{signed(vm.chips.balance)}</b>
          </button>
        </div>
      )}
      <div className="khero-rings">
        {vm.rings.map(r => r.key === 'water' ? (
          <button
            key={r.key}
            type="button"
            className="khero-ring khero-ring-water"
            aria-label={`Víz logolása · ${litersOf(r.value)} a ${litersOf(r.target)} literből`}
            onClick={onWaterRing}
          >
            <RingBody ring={r} filled={filled} gv={litersOf(r.value)} gvTarget={`${litersOf(r.target)} l`} />
          </button>
        ) : (
          <div
            key={r.key}
            className="khero-ring"
            role="progressbar"
            aria-label={`${r.label} ${r.value} / ${r.target}`}
            aria-valuenow={r.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <RingBody ring={r} filled={filled} />
          </div>
        ))}
      </div>
    </div>
  )
}
