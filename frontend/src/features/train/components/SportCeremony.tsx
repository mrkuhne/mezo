// ============================================================
// Mezo · SportCeremony — the sport-session close ceremony (mezo-88iwa.9, T8 Task 5)
//
// The gym twin's own two-act `cer-` scene (WorkoutCeremony.tsx), ported onto a sport
// session: act one drives the sky/stars/gold-bar/counters off ONE rAF pass to
// `score.ratio` (twin of WorkoutCeremony's pass — the ~30-line driver below is
// duplicated rather than extracted, per the T8 Task 5 plan: a shared hook would
// abstract over the two different counter sets for no real gain). Act two
// (`.is-told`) reads the verdict (the SAME workout VERDICTS ladder, cerScore.ts),
// the kcal tile (the WIRE value only — never re-derived, see SportLogPage's own
// honesty note), the +XP tile and the honesty line.
//
// Ported from prototype sport.js:121-155 (ceremonyStep — sky/stars/bar/counters,
// eyebrow "<SPORT> · MA") and :156-177 (detailsStep's kcal tile and closing CTA,
// minus the muscle rows and the "sportot saját mozgásként tartjuk meg" note —
// out of scope for this task, no muscle data is wired here).
//
// Üveg (mezo-me75u.10, prototype docs/design_2.0/prototypes/src/uveg-reteg-body.html
// `cerSport()`): the same family as the glass WorkoutCeremony — it wears `.uv-cer` (U4) plus
// its own `.cer-sport` gap-fillers in the `── uveg reteg unnep (` block. 3D stars on the arc
// over the gold fuse, flat counter cells, the +XP flat gold chip, the frameless sage kcal
// halo and the sage glass CTA with the sport's own `art3d`.
//
// Every number is a prop: this component computes nothing. The kcal tile is
// entirely ABSENT when `kcal` is null (never a fabricated 0); its estimate/own
// wording follows `kcal.isEstimate` verbatim from the wire.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { verdictFor } from '@/features/train/logic/cerScore'
import type { SportScore } from '@/features/train/logic/sportScore'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

export interface SportCeremonyProps {
  score: SportScore
  /** The eyebrow reads "<SPORTNAME> · MA" — same convention as the picker/form headers. */
  sportName: string
  /** The chosen sport's own 3D glyph (`Sport.art3d`: t-volley, t-bike, t-run…) — carried
   *  onto the close CTA. */
  art: Icon3DName
  /** The sport's own accent — set as `--ex-color`, same custom property the gym twin's
   *  muscle rows read, kept here for the day this ceremony grows a domain-colored tile. */
  color: string
  minutes: number
  rpe: number
  /** The WIRE value only (never re-derived here — see SportLogPage's honesty note).
   *  Null hides the tile entirely, never a fabricated 0 kcal. */
  kcal: { value: number; isEstimate: boolean } | null
  /** The finish response's real XP; null hides the tile. */
  xpGained: number | null
  /** The way out: straight to Mai. */
  onClose(): void
  /** Test seam; defaults to `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}

const DURATION_MS = 2400
const STAR_SLOTS = [0, 1, 2, 3, 4]

/** hu-HU grouping, with the locale's thin spaces normalised (the WorkoutCeremony idiom). */
function huNumber(n: number): string {
  return Math.round(n).toLocaleString('hu-HU').replace(/[  ]/g, ' ')
}

/** '4,5' — the Hungarian decimal comma, without depending on the runtime's ICU data. */
function huStars(stars: number): string {
  return String(stars).replace('.', ',')
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Star i lights at (i+1)/5, and is half inside a .1 window below — the workout twin's rule. */
function starClass(index: number, progressed: number): string {
  const threshold = (index + 1) / 5
  if (progressed >= threshold - 0.001) return 'is-lit'
  if (progressed >= threshold - 0.1) return 'is-half'
  return ''
}

export function SportCeremony({
  score, sportName, art, color, minutes, rpe, kcal, xpGained, onClose, reducedMotion,
}: SportCeremonyProps) {
  // No pass at all for reduced motion — the final state paints on the first render.
  const [instant] = useState(() => reducedMotion ?? prefersReducedMotion())
  const [told, setTold] = useState(instant)
  const stageRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const ranRef = useRef(false)

  // The announcement is where the screen starts, for a screen reader and for the keyboard.
  useEffect(() => { headingRef.current?.focus() }, [])

  useEffect(() => {
    // ONE pass per mount, ever: the guard survives every re-render (and a StrictMode
    // double-invoke), same as WorkoutCeremony's driver.
    if (ranRef.current || instant) return
    ranRef.current = true
    const stage = stageRef.current
    if (!stage) return
    // mezo-7tj3j: a start az ELSŐ rAF-időbélyeg — a rAF-óra és a performance.now() origója
    // eltérhet, a clamp pedig ilyenkor 0-n ragadó menetet ad.
    let started: number | null = null
    const paint = (progress: number) => {
      const progressed = progress * score.ratio
      stage.style.setProperty('--p', String(progressed))
      const counts: Record<string, number> = { perc: minutes, rpe, kcal: kcal?.value ?? 0 }
      stage.querySelectorAll<HTMLElement>('[data-cer-count]').forEach((el) => {
        const field = el.dataset.cerCount ?? ''
        el.textContent = String(Math.round((counts[field] ?? 0) * progress))
      })
      stage.querySelectorAll<HTMLElement>('[data-cer-star]').forEach((star) => {
        const cls = starClass(Number(star.dataset.cerStar), progressed)
        star.classList.toggle('is-lit', cls === 'is-lit')
        star.classList.toggle('is-half', cls === 'is-half')
      })
    }
    const frame = (now: number) => {
      if (started === null) started = now
      const t = Math.max(0, Math.min(1, (now - started) / DURATION_MS))
      paint(1 - (1 - t) ** 3)
      if (t < 1 && stage.isConnected) requestAnimationFrame(frame)
      else if (stage.isConnected) setTold(true)
    }
    requestAnimationFrame(frame)
  }, [instant, score, minutes, rpe, kcal])

  // The first painted frame: zero while the pass is about to run, the real value when
  // there is no pass. React never touches these nodes again — the pass owns them.
  const progressed = instant ? score.ratio : 0
  const counterValue = (value: number) => (instant ? String(Math.round(value)) : '0')

  return (
    <div className={`cer-screen cer-details-screen uv-cer cer-sport${told ? ' is-told' : ''}`}>
      {/* — act one — */}
      <section
        ref={stageRef}
        className="cer"
        style={{ '--p': String(progressed), '--ex-color': color } as CSSProperties}
      >
        <span className="cer-sky" aria-hidden="true" />
        <span className="cer-eyebrow">{sportName.toLocaleUpperCase('hu-HU')} · MA</span>
        <div className="cer-stars" aria-hidden="true">
          {STAR_SLOTS.map((i) => (
            <i key={i} data-cer-star={i} className={instant ? starClass(i, progressed) || undefined : undefined}>
              <Icon3D name="t-star-empty" size={56} className="cer-star-off" />
              <Icon3D name="t-star-half" size={56} className="cer-star-half" />
              <Icon3D name="t-star" size={56} className="cer-star-on" />
            </i>
          ))}
        </div>
        <div className="cer-bar" aria-hidden="true">
          <i className="cer-fill" />
          <span className="cer-comet" />
          {[1, 2, 3, 4].map((i) => <u key={i} style={{ '--at': `${i * 20}%` } as CSSProperties} />)}
        </div>
        <div className="cer-counters">
          <span className="uv-flat">
            <Icon3D name="t-clock" size={26} />
            <strong data-cer-count="perc">{counterValue(minutes)}</strong>
            <small>perc</small>
          </span>
          <span className="uv-flat">
            <Icon3D name="t-flame" size={26} />
            <strong data-cer-count="rpe">{counterValue(rpe)}</strong>
            <small>RPE</small>
          </span>
          {kcal && (
            <span className="uv-flat">
              <Icon3D name="t-plate" size={26} />
              <strong data-cer-count="kcal">{counterValue(kcal.value)}</strong>
              <small>kcal</small>
            </span>
          )}
        </div>
      </section>

      {/* — act two: the reading — */}
      <section className="cer-result">
        <h1 className="sr-only" tabIndex={-1} ref={headingRef}>
          {huStars(score.stars)} csillag az ötből
        </h1>
        <p className="cer-verdict">{verdictFor(score.stars)}</p>
        {xpGained != null && (
          <div className="cer-xpline">
            <span className="cer-xp uv-flat">
              <Icon3D name="t-coin" size={22} />
              <strong>+{huNumber(xpGained)}</strong><small>szerzett XP</small>
            </span>
          </div>
        )}
      </section>

      <div className="cer-foot">
        {kcal && (
          <div className="cer-kcal uv-halo">
            <span className="cer-kcal-line">
              <Icon3D name="t-bowl" size={66} className="cer-kcal-art" />
              <b>+</b><strong>{huNumber(kcal.value)}</strong><small>kcal</small>
            </span>
            <span className="cer-kcal-copy">Ennyit nyertél a mai mozgással</span>
            <span className="cer-recap-note">{kcal.isEstimate ? 'Becslés, nem mérés' : 'Saját értéked'}</span>
          </div>
        )}

        <div className="cer-cta">
          <button type="button" className="cer-go is-done glass" onClick={onClose}>
            <Icon3D name={art} size={44} />
            <span>
              <strong>Vissza a mai napra</strong>
              <small>{sportName} elmentve</small>
            </span>
            <em aria-hidden="true">›</em>
          </button>
        </div>

        <p className="cer-recap-note">
          A csillagok az edzésidőből és az erőfeszítésből számolnak, nem AI-értékelés.
        </p>
      </div>
    </div>
  )
}
