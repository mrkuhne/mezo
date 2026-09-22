// ============================================================
// Mezo · WorkoutCeremony — the TWO-STEP workout-close ceremony (mezo-e1ii9, T3)
//
// 1:1 with the prototype (`session.js` `summary()` → `detailsStep()`): the ceremony is two
// SCREENS inside the same overlay, not one screen in two acts. T7 collapsed them onto one
// page citing the ceremony-pattern doc; the owner's directive is 1:1 with the prototype, so
// the split is restored here and the doc corrected to match what ships.
//
//   Step 1 `.cer-screen.is-staged` (jutalomoldalak, mezo-p2777 — spec
//     docs/superpowers/specs/2026-09-22-jutalomoldalak-design.md) — ONE hero: the five-star
//     ARC over the stone FUSE (no star numeral — owner D3: the stars are the reward). Then,
//     beat by beat, the verdict, ONE card (the record strip, the honest minutes + XP pair,
//     the quiet szett/ismétlés/kg×rep tally), the pending-sets line and exactly ONE way on:
//     `Részletek`. One rAF pass (2700 ms) burns the fuse and lights the stars over the first
//     1700 ms, toggles the beat classes `is-b1/2/3`, and runs the card's tally at the end.
//   Step 2 `.cer-details-screen` — a recap chip (mini stars + verdict) tying it to step one,
//     the kcal hero, then `Izomcsoportok fejlődése a mai edzésen` as ONE card of rows (each
//     with its MuscleMap crop, mini-stars and its OWN done/plan fill bar — `ZoneTrack` and
//     the weekly zone it drew are gone from the app entirely, this bar is the row's
//     completion share and nothing else), the closing note, the close CTA,
//     `Vissza az értékeléshez` back to step 1, and the star footnote.
//
// Fills and counters are FRAME-driven (a throttled/hidden webview freezes a just-started CSS
// transition at 0), so the pass writes `--p`, the counter textContents and the star
// is-lit/is-half classes itself. `reducedMotion` (defaults to the media query) and `settled`
// (the recap read-back) paint the final state on the FIRST render — no pass at all. The pass
// is guarded by a ref, so neither a re-render nor a trip to step 2 and back can restart it
// (the ceremony plays exactly once per close).
//
// The küldetés rows and the streak line that T7 carried here are GONE: neither has a
// prototype counterpart in the ceremony. The challenge outcomes keep their other home — the
// review page (`WorkoutReviewPage` → `WorkoutSummary`'s own challenge strip).
//
// Every number is a prop: this component computes nothing and fabricates nothing. A tile
// whose input is unknown is not rendered — never a 0 (minutes, XP, kcal).
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { verdictFor, type CerScore, type MuscleStarRow } from '@/features/train/logic/cerScore'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { ClayIcon } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'

export interface WorkoutCeremonyProps {
  score: CerScore
  /** The overline above the stars — 'EDZÉS LEZÁRVA'. */
  eyebrow: string
  /** MEASURED minutes only; null hides the tile (no fabricated estimate — see the page). */
  minutes: number | null
  /** The finish response's real XP; null hides the tile. */
  xpGained: number | null
  /** The RECORD-tier medals earned this session, already rendered to copy. */
  records: Array<{ name: string; value: string }>
  muscles: MuscleStarRow[]
  /** The T5 `trainDayEnergy` estimate; null hides the tile (never a 0 kcal). */
  kcal: { value: number; known: true } | null
  /** The closing-note draft, owned by the page. */
  note: string
  onNote(v: string): void
  /** The way out: straight to Mai. */
  onClose(): void
  onGoFuel(): void
  /** Recap mode: paint the final state, no pass. */
  settled?: boolean
  /** How many sets the close left pending; >0 adds the recap's honest note. */
  pendingSets?: number
  /** Test seam; defaults to `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}

/** The whole step-one pass; the stars/fuse burn over the first STARS_MS of it. */
const DURATION_MS = 2700
const STARS_MS = 1700
/** When each beat lands: verdict (b1), the card + its tally (b2), the record stamp (b3). */
const BEATS = { b1: 1750, b2: 2050, b3: 2350 } as const
const STAR_SLOTS = [0, 1, 2, 3, 4]
const ALL_BEATS = ' is-b1 is-b2 is-b3'

const ease = (t: number) => 1 - (1 - t) ** 3

/** hu-HU grouping, with the locale's thin spaces normalised (the ExerciseRecordSheet idiom). */
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

/** runCeremony's thresholds: star i lights at (i+1)/5, and is half inside a .1 window below. */
function starClass(index: number, progressed: number): string {
  const threshold = (index + 1) / 5
  if (progressed >= threshold - 0.001) return 'is-lit'
  if (progressed >= threshold - 0.1) return 'is-half'
  return ''
}

export function WorkoutCeremony({
  score, eyebrow, minutes, xpGained, records, muscles, kcal,
  note, onNote, onClose, onGoFuel, settled = false, pendingSets = 0, reducedMotion,
}: WorkoutCeremonyProps) {
  // The pass is skipped entirely for the recap read-back and for reduced motion — both
  // paint the final state on the first render, so the reading is told immediately.
  const [instant] = useState(() => settled || (reducedMotion ?? prefersReducedMotion()))
  const [told, setTold] = useState(instant)
  const [step, setStep] = useState<'summary' | 'details'>('summary')
  const [detailsTold, setDetailsTold] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const detailsHeadingRef = useRef<HTMLHeadingElement>(null)
  const ranRef = useRef(false)
  const mountedRef = useRef(false)

  // The announcement is where each step starts, for a screen reader and for the keyboard.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      headingRef.current?.focus()
      return
    }
    if (step === 'details') detailsHeadingRef.current?.focus()
    else headingRef.current?.focus()
  }, [step])

  // Step two plays too (prototype render(): `is-told` added on the next frame, so the
  // muscle bars/stars and the kcal tile have a state to transition FROM).
  useEffect(() => {
    if (step !== 'details' || detailsTold) return
    if (instant) { setDetailsTold(true); return }
    const id = requestAnimationFrame(() => setDetailsTold(true))
    return () => cancelAnimationFrame(id)
  }, [step, detailsTold, instant])

  useEffect(() => {
    // ONE pass per mount, ever: the guard survives every re-render (and a StrictMode
    // double-invoke, which is why the frame loop stops on `isConnected` instead of a
    // cleanup that would cancel the only scheduled pass).
    if (ranRef.current || instant) return
    ranRef.current = true
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return
    const started = performance.now()
    const counts: Record<string, number> = {
      sets: score.done.sets, reps: score.done.reps, volume: score.done.volume,
    }
    const paint = (ms: number) => {
      const progressed = ease(Math.min(1, ms / STARS_MS)) * score.ratio
      stage.style.setProperty('--p', String(progressed))
      stage.querySelectorAll<HTMLElement>('[data-cer-star]').forEach((star) => {
        const cls = starClass(Number(star.dataset.cerStar), progressed)
        star.classList.toggle('is-lit', cls === 'is-lit')
        star.classList.toggle('is-half', cls === 'is-half')
      })
      // The card's tally runs while the card is up (beat 2 → the end of the pass).
      const tally = ease(Math.max(0, Math.min(1, (ms - BEATS.b2) / (DURATION_MS - BEATS.b2))))
      root.querySelectorAll<HTMLElement>('[data-cer-count]').forEach((el) => {
        const field = el.dataset.cerCount ?? ''
        const value = (counts[field] ?? 0) * tally
        el.textContent = field === 'volume' ? huNumber(value) : String(Math.round(value))
      })
      root.classList.toggle('is-b1', ms >= BEATS.b1)
      root.classList.toggle('is-b2', ms >= BEATS.b2)
      root.classList.toggle('is-b3', ms >= BEATS.b3)
    }
    const frame = (now: number) => {
      // Fix round 1 (mezo-88iwa.8): a rAF timestamp can land before `started` (observed
      // -3 ismétlés mid-pass), so clamp both ends rather than just the top.
      const ms = Math.max(0, Math.min(DURATION_MS, now - started))
      paint(ms)
      if (ms < DURATION_MS && stage.isConnected) requestAnimationFrame(frame)
      // `told` is set even when the stage left the DOM mid-pass (a tap on `Részletek`
      // before it landed): step one is re-entered from step two, and React must paint the
      // FINAL numbers there — the pass that owned those nodes is gone and never re-runs.
      else setTold(true)
    }
    requestAnimationFrame(frame)
  }, [instant, score])

  // The first painted frame: zeroes while the pass is about to run, the real values once it
  // has landed (or when there is no pass at all). While the pass runs, React never touches
  // these nodes — the rendered value does not change, so there is nothing to patch.
  const progressed = told ? score.ratio : 0
  const counterValue = (value: number, volume = false) =>
    told ? (volume ? huNumber(value) : String(value)) : volume ? huNumber(0) : '0'

  // ---------- step two: what the session did to the week, and the way out ----------
  if (step === 'details') {
    return (
      // The `key` is load-bearing: both steps return a bare <div> at the same position, and
      // React would otherwise REUSE step one's DOM nodes (the ceremony stage included) for
      // step two's — leaving the still-running rAF pass writing into the details screen.
      <div key="details" className={`cer-details-screen${detailsTold ? ' is-told' : ''}`}>
        {/* Step two's focus target, unconditionally — a session with no muscle rows must
            still land focus here on entry, not on <body> (mezo-e1ii9 Task 3, fix round 1). */}
        <h2 className="sr-only" tabIndex={-1} ref={detailsHeadingRef}>
          Az edzés részletei
        </h2>
        {/* The recap chip: step one's verdict in one line, so step two reads as its sequel. */}
        <div className="cer-recap-chip">
          <span className="cer-starrow mini" aria-hidden="true">
            {STAR_SLOTS.map((s) => (
              <i key={s} className={starClass(s, score.ratio)}>
                <ClayIcon name="i-termes" size={15} className="icon" />
              </i>
            ))}
          </span>
          <span>{verdictFor(score.stars)}</span>
        </div>

        {kcal && (
          <button type="button" className="cer-kcal" onClick={onGoFuel}>
            <span className="cer-kcal-line">
              <ClayIcon name="i-fuel" size={62} className="icon" />
              <b>+</b><strong>{huNumber(kcal.value)}</strong><small>kcal</small>
            </span>
            <span className="cer-kcal-copy">Ennyit nyertél a mai mozgással</span>
            <span className="cer-recap-note">Becslés, nem mérés</span>
            <i className="cer-kcal-go">›</i>
          </button>
        )}

        {muscles.length > 0 && (
          <section className="cer-muscles">
            <div className="cer-section">
              <strong>Izomcsoportok fejlődése a mai edzésen</strong>
            </div>
            <div className="cer-mstars">
              {muscles.map((row, i) => (
                <div
                  key={row.muscle}
                  className="cer-mstar"
                  style={{ '--ex-color': muscleColor(row.muscle).rail, '--i': i } as CSSProperties}
                >
                  <span className="cer-mstar-art"><MuscleChip token={row.muscle} size={40} /></span>
                  <span className="cer-mstar-copy">
                    <strong>{row.label}</strong>
                    <small>{row.done} / {row.plan} szett</small>
                  </span>
                  <span className="cer-starrow mini" aria-hidden="true">
                    {STAR_SLOTS.map((s) => (
                      <i key={s} className={starClass(s, row.ratio)} style={{ '--s': s } as CSSProperties}>
                        <ClayIcon name="i-termes" size={15} className="icon" />
                      </i>
                    ))}
                  </span>
                  {/* The fill width is an inline custom property, so the reveal is a
                      frame-independent CSS transition on a value that is already there. */}
                  <span className="cer-mstar-track">
                    <i className="fill" style={{ '--w': `${row.ratio * 100}%` } as CSSProperties} />
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* The closing note (mezo-d20.8.2.2) travels with the way out — the draft is the
            page's, and the page guarantees the save on both CTAs AND on unmount. */}
        <div className="wsum-note">
          <span className="wsum-note-q">Hogy ment?</span>
          <textarea
            className="wsum-note-ta"
            maxLength={1000}
            value={note}
            aria-label="Hogy ment?"
            placeholder="Pl. rosszul aludtam, de a húzódzkodás jól ment…"
            onChange={(e) => onNote(e.target.value)}
          />
          <p className="wsum-note-hint">Nem kötelező — később is hozzáírhatod.</p>
        </div>

        <div className="cer-cta">
          <button type="button" className="wo-close-cta is-done" onClick={onClose}>
            <span className="wo-close-art"><Icon name="check" size={34} /></span>
            <span>
              <strong>Vissza a mai napra</strong>
              <small>Az edzés lezárva és elmentve</small>
            </span>
            <u className="chip-sheen" />
          </button>
          <button type="button" className="wo-secondary" onClick={() => setStep('summary')}>
            Vissza az értékeléshez
          </button>
        </div>

        <p className="cer-recap-note">
          A csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem AI-értékelés.
        </p>
      </div>
    )
  }

  // ---------- step one: the ceremony owns the screen, and ends with the way on ----------
  return (
    <div
      key="summary"
      ref={rootRef}
      className={`cer-screen is-staged${told ? `${ALL_BEATS} is-told` : ''}`}
    >
      <section
        ref={stageRef}
        className={`cer${settled ? ' is-settled' : ''}`}
        style={{ '--p': String(progressed) } as CSSProperties}
      >
        <span className="cer-sky" aria-hidden="true" />
        <span className="cer-eyebrow">{eyebrow}</span>
        {/* The hero: five stars on an arc, the middle one largest (sizes live in the CSS). */}
        <div className="cer-stars" aria-hidden="true">
          {STAR_SLOTS.map((i) => (
            <i key={i} data-cer-star={i} className={told ? starClass(i, progressed) : undefined}>
              <b className="cer-aura" />
              <ClayIcon name="i-termes" size={56} className="icon" />
            </i>
          ))}
        </div>
        {/* The fuse: the stone bar, five segments — one per star. */}
        <div className="cer-bar" aria-hidden="true">
          <i className="cer-fill" />
          <span className="cer-comet" />
          {[1, 2, 3, 4].map((i) => <u key={i} style={{ '--at': `${i * 20}%` } as CSSProperties} />)}
        </div>
      </section>

      <section className="cer-result">
        <h1 className="sr-only" tabIndex={-1} ref={headingRef}>
          {huStars(score.stars)} csillag az ötből
        </h1>
        <p className="cer-verdict">{verdictFor(score.stars)}</p>
        {/* ONE card for every secondary number — never a scatter of peer tiles. */}
        <div className="cer-card">
          {records.length > 0 && (
            <div className="cer-record">
              <ClayIcon name="i-erme" size={38} className="icon" />
              <span>
                <strong>{records.length === 1 ? 'Új rekord' : `${records.length} új rekord`}</strong>
                <small>{records.map((r) => `${r.name} · ${r.value}`).join(' · ')}</small>
              </span>
            </div>
          )}
          {minutes != null || xpGained != null ? (
            <div className="cer-stats">
              {minutes != null && (
                <span>
                  <ClayIcon name="i-idozito" size={30} className="icon" />
                  <strong>{minutes}<i>′</i></strong><small>a pulton töltött idő</small>
                </span>
              )}
              {xpGained != null && (
                <span>
                  <ClayIcon name="i-kristaly" size={30} className="icon" />
                  <strong>+{huNumber(xpGained)}</strong><small>szerzett XP</small>
                </span>
              )}
            </div>
          ) : null}
          <div className="cer-tally">
            <span>
              <ClayIcon name="i-suly" size={20} className="icon" />
              <b data-cer-count="sets">{counterValue(score.done.sets)}</b>
              <small>szett</small>
            </span>
            <span>
              <ClayIcon name="i-edzes" size={20} className="icon" />
              <b data-cer-count="reps">{counterValue(score.done.reps)}</b>
              <small>ismétlés</small>
            </span>
            <span>
              <ClayIcon name="i-stack" size={20} className="icon" />
              <b data-cer-count="volume">{counterValue(score.done.volume, true)}</b>
              <small>kg × rep</small>
            </span>
          </div>
        </div>
        {/* The honest tail: the close did not tick everything (prototype recap()). */}
        {pendingSets > 0 && (
          <p className="cer-recap-note">{pendingSets} szett kihagyott státusszal zárult.</p>
        )}
      </section>

      {/* The single way on — the prototype's only CTA on this screen. */}
      <div className="cer-foot">
        {/* `.cer-cta` is what carries the CTA chrome (`.cer-cta .wo-close-cta`, prototype.css) —
            the wrapper is the style hook, not decoration. */}
        <div className="cer-cta">
          <button type="button" className="wo-close-cta" onClick={() => setStep('details')}>
            <span className="wo-close-art"><ClayIcon name="i-naplo" size={34} className="icon" /></span>
            <span>
              <strong>Részletek</strong>
              <small>Izomcsoportok és a nyert kalória</small>
            </span>
            <u className="chip-sheen" />
          </button>
        </div>
      </div>
    </div>
  )
}
