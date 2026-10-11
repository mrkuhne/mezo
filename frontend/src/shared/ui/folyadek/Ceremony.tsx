// The closing ceremony's stage in the Folyadék material (prototype vilagos/edzes.js `cstars` + `runCer`): five stars over a
// cup that fills to the score; what spills over the rim is the record. The PATTERN is unchanged
// (docs/design_2.0/2026-09-15-ceremony-pattern.md): ONE requestAnimationFrame pass, cubic ease-out, drives the stars, the
// level, the counters and the beats; reduced motion (or a settled re-entry) paints the end state on the first render.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { cx, useSvgId } from './util'
import { fmtInt } from '@/shared/lib/format'

/** The pass's timing (ms): the whole pass, the stars + level part, and the three beats that reveal the reading. */
export const CEREMONY_MS = { total: 2700, stars: 1700, b1: 1750, b2: 2050, b3: 2350 } as const
const ease = (t: number) => 1 - (1 - t) ** 3

/** One star slot against the progressed share (0–1): lit from its fifth, half from a tenth below it. */
export function starState(index: number, progressed: number): 'lit' | 'half' | 'off' {
  const threshold = (index + 1) / 5
  if (progressed >= threshold - 0.001) return 'lit'
  if (progressed >= threshold - 0.1) return 'half'
  return 'off'
}

/** A 0–1 share as stars in halves, by the same thresholds the stage paints with (for `StarRow` beside a muscle). */
export function ratioStars(ratio: number): number {
  return [0, 1, 2, 3, 4].reduce((a, i) => a + ({ lit: 1, half: 0.5, off: 0 })[starState(i, ratio)], 0)
}

const huCount = (n: number) => fmtInt(n)

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface CeremonyPass {
  /** Put on the ceremony's root (`CeremonyRoot` does it): the pass paints everything inside it. */
  rootRef: RefObject<HTMLDivElement | null>
  ratio: number
  /** The end state is on screen (the pass landed, or there never was one). */
  told: boolean
  /** No pass at all: reduced motion, or a settled re-entry. */
  instant: boolean
}

/**
 * The ONE pass. Inside the root it writes, per frame: `--p` on `[data-cer-stage]`, `is-lit` / `is-half` on every
 * `[data-cer-star]`, the text of every `[data-cer-count]` (towards its `data-value`, in the last stretch), and the beat
 * classes `b1` `b2` `b3` on the root. It writes the DOM itself rather than handing values to CSS transitions, because a
 * throttled or hidden webview freezes a just-started transition at 0. A ref guards it: no re-render restarts it.
 * `settled` / reduced motion skip it — the pieces then render the end state themselves (`told` is true from the start).
 */
export function useCeremonyPass(opts: { ratio: number; settled?: boolean; reducedMotion?: boolean }): CeremonyPass {
  const [instant] = useState(() => !!opts.settled || (opts.reducedMotion ?? prefersReducedMotion()))
  const [told, setTold] = useState(instant)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const ran = useRef(false)
  const ratio = opts.ratio
  useEffect(() => {
    if (ran.current || instant) return
    ran.current = true
    const root = rootRef.current
    if (!root) return
    let started: number | null = null
    const paint = (ms: number) => {
      const progressed = ease(Math.min(1, ms / CEREMONY_MS.stars)) * ratio
      root.querySelectorAll<HTMLElement>('[data-cer-stage]').forEach((el) => el.style.setProperty('--p', String(progressed)))
      root.querySelectorAll<HTMLElement>('[data-cer-star]').forEach((el) => {
        const st = starState(Number(el.dataset.cerStar), progressed)
        el.classList.toggle('is-lit', st === 'lit')
        el.classList.toggle('is-half', st === 'half')
      })
      const tally = ease(Math.max(0, Math.min(1, (ms - CEREMONY_MS.b2) / (CEREMONY_MS.total - CEREMONY_MS.b2))))
      root.querySelectorAll<HTMLElement>('[data-cer-count]').forEach((el) => { el.textContent = huCount(Number(el.dataset.value ?? 0) * tally) })
      root.classList.toggle('b1', ms >= CEREMONY_MS.b1)
      root.classList.toggle('b2', ms >= CEREMONY_MS.b2)
      root.classList.toggle('b3', ms >= CEREMONY_MS.b3)
    }
    const frame = (now: number) => {
      if (started === null) started = now
      const ms = Math.max(0, Math.min(CEREMONY_MS.total, now - started))
      paint(ms)
      if (ms < CEREMONY_MS.total && root.isConnected) requestAnimationFrame(frame)
      else if (root.isConnected) setTold(true)
    }
    requestAnimationFrame(frame)
  }, [instant, ratio])
  return { rootRef, ratio, told, instant }
}

/** The ceremony's root: carries the pass's ref and, once told, every beat. */
export function CeremonyRoot({ pass, className, children }: { pass: CeremonyPass; className?: string; children: ReactNode }) {
  return <div ref={pass.rootRef} className={cx('fo-cer', pass.told && 'b1 b2 b3 told', pass.instant && 'inst', className)}>{children}</div>
}

/** What the beats reveal: `beat={1}` comes with the verdict, `beat={2}` with the numbers. */
export function CeremonyReveal({ beat, className, children }: { beat: 1 | 2; className?: string; children: ReactNode }) {
  return <div className={cx(beat === 1 ? 'fo-cer-res' : 'fo-cer-card', className)}>{children}</div>
}

/** A number the pass counts up to (whole numbers, locale grouping). Shows the end value when the pass is told. */
export function CeremonyCount({ pass, value }: { pass: CeremonyPass; value: number }) {
  return <b data-cer-count="" data-value={value}>{pass.told ? huCount(value) : '0'}</b>
}

const CUP = 'M24 14 H176 V62 C176 100 144 122 100 122 C56 122 24 100 24 62Z'
/** The liquid's wavy surface, wide enough to drift (prototype `wv(-120,14,440,11,5)`). */
const SURFACE = `M-120 14${' q10 -5 20 0 q10 5 20 0'.repeat(11)} V140 H-120Z`
const SPILL = [
  'M72 -14.25 C78.05 -7.1 77.5 -0.5 72 -0.5 C66.5 -0.5 65.95 -7.1 72 -14.25Z',
  'M128 -17.25 C134.05 -10.1 133.5 -3.5 128 -3.5 C122.5 -3.5 121.95 -10.1 128 -17.25Z',
  'M90 -25 C94.4 -19.8 94 -15 90 -15 C86 -15 85.6 -19.8 90 -25Z',
  'M112 -9 C116.4 -3.8 116 1 112 1 C108 1 107.6 -3.8 112 -9Z',
  'M102 -31.1 C105.74 -26.68 105.4 -22.6 102 -22.6 C98.6 -22.6 98.26 -26.68 102 -31.1Z',
]

/**
 * The stage: an eyebrow, five stars, the cup, then whatever is passed as children (the verdict and its line — wrap them
 * in `CeremonyReveal beat={1}`). `spill` draws the drops above the rim (a record was set). The stars and the cup are
 * decoration: give the score to screen readers in `label` or in a heading of your own.
 */
export function CupStage({ pass, label, spill, className, children }: { pass: CeremonyPass; label?: ReactNode; spill?: boolean; className?: string; children?: ReactNode }) {
  const id = useSvgId('focup')
  const p = pass.told ? pass.ratio : 0
  return (
    <section className={cx('fo-card fo-hero fo-cer-stage', className)} data-cer-stage="" style={{ '--p': String(p) } as CSSProperties}>
      {label != null && <span className="fo-hero-lbl">{label}</span>}
      <div className="fo-cer-stars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => {
          const st = pass.told ? starState(i, p) : 'off'
          return (
            <i key={i} data-cer-star={i} className={st === 'lit' ? 'is-lit' : st === 'half' ? 'is-half' : undefined}>
              <Icon3D name="t-star-empty" size={46} className="off" />
              <Icon3D name="t-star-half" size={46} className="half" />
              <Icon3D name="t-star" size={46} className="on" />
            </i>
          )
        })}
      </div>
      <div className="fo-cup" aria-hidden="true">
        <svg viewBox="0 -34 200 166">
          <defs>
            <clipPath id={id}><path d={CUP} /></clipPath>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F9D06A" /><stop offset="1" stopColor="#E9892B" /></linearGradient>
          </defs>
          <path d={CUP} fill="#fff" stroke="rgba(10,42,60,.12)" strokeWidth="2.5" />
          <g clipPath={`url(#${id})`}>
            <g className="lq"><path className="wvp" fill={`url(#${id}g)`} d={SURFACE} /></g>
            {[0.4, 0.6, 0.8].map((t) => <path key={t} d={`M152 ${14 + 108 * (1 - t)}h14`} stroke="rgba(10,42,60,.28)" strokeWidth="2" strokeLinecap="round" />)}
            <path d="M40 26 V58" stroke="rgba(255,255,255,.8)" strokeWidth="6" strokeLinecap="round" />
          </g>
          {spill && SPILL.map((d, i) => <path key={i} className={`sp s${i + 1}`} d={d} />)}
        </svg>
      </div>
      {children}
    </section>
  )
}
