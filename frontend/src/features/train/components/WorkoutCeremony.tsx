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
//     ARC over the FUSE (no star numeral — owner D3: the stars are the reward). Then,
//     beat by beat, the verdict, the amber glass RECORDS card (only when records exist),
//     the stats glass card (minutes + XP, the quiet szett/ismétlés/kg×rep tally and the
//     accepted küldetések with their outcome), the pending-sets line and exactly ONE way on:
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
// Üveg re-dress (mezo-me75u.4, prototype uveg-edzes.html#cer): 3D sprite stars, glass cards
// (`.uv-cer` scopes every override — SportCeremony shares the `.cer-*` family). The owner
// approved one content addition there: the stats card's `Küldetések · hit / total` section —
// the session's ACCEPTED challenges, each with a round outcome icon (accessible name only).
// The streak line T7 carried stays gone.
//
// Every number is a prop: this component computes nothing and fabricates nothing. A tile
// whose input is unknown is not rendered — never a 0 (minutes, XP, kcal).
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Challenge } from '@/data/types'
import type { Medal } from '@/data/train/medalTypes'
import { verdictFor, type CerScore, type MuscleStarRow } from '@/features/train/logic/cerScore'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { MEDAL_TYPE_LABEL, formatMedalNumber } from '@/features/train/logic/medalLabels'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { challengeTypeIcon, challengeTypeLabel, targetChips } from '@/features/train/logic/challengeDisplay'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

/** One record row of the step-one records card: the exercise, the medal type label
 *  (MEDAL_TYPE_LABEL) and the plain achieved values as chips ('105 kg', '10 ism.'). */
export interface CeremonyRecord { name: string; kind: string; values: string[] }

/** One ACCEPTED challenge of the session with its outcome (the stats card's Küldetések). */
export interface CeremonyChallenge {
  id: string
  type: string
  typeLabel: string
  exercise?: string
  target: string
  status: 'hit' | 'miss' | 'inconclusive'
}

/** hu-HU number with the locale's (narrow) no-break spaces normalised to a plain space. */
const huNum = (n: number) => formatMedalNumber(n).replace(/[\u00a0\u202f]/g, ' ')

/**
 * A RECORD medal as the ceremony's chip row — the medal's own fields, never a recomputation.
 * WEIGHT: the load, then the reps; REPS_AT_WEIGHT: the reps, then the load; E1RM and
 * SESSION_VOLUME: their derived headline in kg (see medalLabels' DERIVED_HEADLINE_TYPES).
 */
export function ceremonyRecord(m: Medal): CeremonyRecord {
  const kg = m.weightKg != null ? `${huNum(m.weightKg)} kg` : null
  const reps = m.reps != null ? `${m.reps} ism.` : null
  let values: string[]
  switch (m.type) {
    case 'WEIGHT':
      values = kg ? [kg, ...(reps ? [reps] : [])] : [`${huNum(m.value)} kg`]
      break
    case 'REPS_AT_WEIGHT':
    case 'TARGET_HIT':
      values = [reps ?? `${m.value} ism.`, ...(kg ? [kg] : [])]
      break
    default:
      values = [`${huNum(m.value)} kg`]
  }
  return { name: m.exerciseName, kind: MEDAL_TYPE_LABEL[m.type] ?? m.type, values }
}

/**
 * The session's ACCEPTED challenges with their outcome, for the stats card. `accepted` is the
 * page's own accept map; an `inconclusive` challenge was accepted too (the map only counts
 * accepted/hit/miss). Anything not yet resolved to hit/miss reads as `inconclusive`.
 */
export function ceremonyChallenges(challenges: Challenge[], accepted: Record<string, boolean>): CeremonyChallenge[] {
  return challenges
    .filter((c) => accepted[c.id] || c.status === 'inconclusive')
    .map((c) => ({
      id: c.id,
      type: c.type,
      typeLabel: c.typeLabel,
      exercise: c.exercise,
      target: c.target,
      status: c.status === 'hit' || c.status === 'miss' ? c.status : 'inconclusive',
    }))
}

export interface WorkoutCeremonyProps {
  score: CerScore
  /** The overline above the stars — 'EDZÉS LEZÁRVA'. */
  eyebrow: string
  /** MEASURED minutes only; null hides the tile (no fabricated estimate — see the page). */
  minutes: number | null
  /** The finish response's real XP; null hides the tile. */
  xpGained: number | null
  /** The RECORD-tier medals earned this session, as chip rows (see `ceremonyRecord`). */
  records: CeremonyRecord[]
  /** The session's ACCEPTED challenges with their outcome (see `ceremonyChallenges`);
   *  empty/absent hides the stats card's Küldetések section. */
  challenges?: CeremonyChallenge[]
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

/** A star slot as the 3D sprite: lit, half or the dimmed empty star. */
function starIcon(cls: string): Icon3DName {
  return cls === 'is-lit' ? 't-star' : cls === 'is-half' ? 't-star-half' : 't-star-empty'
}

/** The mini star row (recap chip, muscle rows) — drawn, not written. */
function MiniStars({ ratio }: { ratio: number }) {
  return (
    <span className="cer-starrow mini" aria-hidden="true">
      {STAR_SLOTS.map((s) => {
        const cls = starClass(s, ratio)
        return (
          <i key={s} className={cls} style={{ '--s': s } as CSSProperties}>
            <Icon3D name={starIcon(cls)} size={16} />
          </i>
        )
      })}
    </span>
  )
}

/** Record type label → its 3D icon (the medal type, not a generic medal). */
const RECORD_KIND_ICON: Record<string, Icon3DName> = {
  'Súly-rekord': 't-weight', 'Rep-rekord': 't-repeat', '1RM-rekord': 't-ring', 'Volumen-rekord': 't-protocol',
}
/** Challenge type → its 3D icon. */
const CHALLENGE_OUTCOME: Record<CeremonyChallenge['status'], { icon: Icon3DName; label: string }> = {
  hit: { icon: 't-tick', label: 'teljesült' },
  miss: { icon: 't-skip', label: 'nem teljesült' },
  inconclusive: { icon: 't-skip', label: 'nem értékelhető' },
}

export function WorkoutCeremony({
  score, eyebrow, minutes, xpGained, records, challenges = [], muscles, kcal,
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
    // mezo-7tj3j: a start az ELSŐ rAF-időbélyeg — a rAF-óra és a performance.now() origója
    // eltérhet, a clamp pedig ilyenkor 0-n ragadó menetet ad.
    let started: number | null = null
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
      // Fix round 1 (mezo-88iwa.8): clamp both ends; mezo-7tj3j: anchor to the first frame.
      if (started === null) started = now
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
      <div key="details" className={`cer-details-screen uv-cer${detailsTold ? ' is-told' : ''}`}>
        {/* Step two's focus target, unconditionally — a session with no muscle rows must
            still land focus here on entry, not on <body> (mezo-e1ii9 Task 3, fix round 1). */}
        <h2 className="sr-only" tabIndex={-1} ref={detailsHeadingRef}>
          Az edzés részletei
        </h2>
        {/* The recap pill: step one's verdict in one line, so step two reads as its sequel. */}
        <div className="cer-recap-chip uv-flat">
          <MiniStars ratio={score.ratio} />
          <span>{verdictFor(score.stars)}</span>
        </div>

        {/* The kcal hero: a frameless sage halo, no card (§3.4 rank 1). */}
        {kcal && (
          <button type="button" className="cer-kcal uv-halo" onClick={onGoFuel}>
            <span className="cer-kcal-line">
              <Icon3D name="t-bowl" size={66} className="cer-kcal-art" />
              <b>+</b><strong>{huNumber(kcal.value)}</strong><small>kcal</small>
            </span>
            <span className="cer-kcal-copy">Ennyit nyertél a mai mozgással</span>
            <span className="cer-recap-note">Becslés, nem mérés</span>
            <i className="cer-kcal-go" aria-hidden="true">›</i>
          </button>
        )}

        {muscles.length > 0 && (
          <section className="cer-muscles">
            <div className="cer-section">
              <strong>Izomcsoportok fejlődése a mai edzésen</strong>
            </div>
            {/* ONE coral glass card; each row wears its own muscle colour (`--c`) on its art
                and its bar — flat inside the glass, never a card in a card. */}
            <div className="cer-mstars glass">
              {muscles.map((row, i) => {
                const color = muscleColor(row.muscle).rail
                return (
                  <div
                    key={row.muscle}
                    className="cer-mstar"
                    style={{ '--ex-color': color, '--c': color, '--i': i } as CSSProperties}
                  >
                    <span className="cer-mstar-art"><MuscleChip token={row.muscle} size={40} /></span>
                    <span className="cer-mstar-copy">
                      <strong>{row.label}</strong>
                      <small>{row.done} / {row.plan} szett</small>
                    </span>
                    <MiniStars ratio={row.ratio} />
                    {/* The fill width is an inline custom property, so the reveal is a
                        frame-independent CSS transition on a value that is already there. */}
                    <span className="cer-mstar-track">
                      <i className="fill" style={{ '--w': `${row.ratio * 100}%` } as CSSProperties} />
                    </span>
                  </div>
                )
              })}
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
          <button type="button" className="cer-go is-done glass" onClick={onClose}>
            <Icon3D name="t-tick" size={44} />
            <span>
              <strong>Vissza a mai napra</strong>
              <small>Az edzés lezárva és elmentve</small>
            </span>
            <em aria-hidden="true">›</em>
          </button>
          <button type="button" className="cer-back uv-flat" onClick={() => setStep('summary')}>
            Vissza az értékeléshez
          </button>
        </div>

        <p className="cer-recap-note">
          A csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem AI-értékelés.
        </p>
      </div>
    )
  }

  const hitCount = challenges.filter((c) => c.status === 'hit').length

  // ---------- step one: the ceremony owns the screen, and ends with the way on ----------
  return (
    <div
      key="summary"
      ref={rootRef}
      className={`cer-screen is-staged uv-cer${told ? `${ALL_BEATS} is-told` : ''}`}
    >
      <section
        ref={stageRef}
        className={`cer${settled ? ' is-settled' : ''}`}
        style={{ '--p': String(progressed) } as CSSProperties}
      >
        <span className="cer-sky" aria-hidden="true" />
        <span className="cer-eyebrow">{eyebrow}</span>
        {/* The hero: five 3D stars on an arc, the middle one largest (sizes live in the CSS).
            Each slot carries all three states; the pass's is-lit / is-half class picks one. */}
        <div className="cer-stars" aria-hidden="true">
          {STAR_SLOTS.map((i) => (
            <i key={i} data-cer-star={i} className={told ? starClass(i, progressed) : undefined}>
              <b className="cer-aura" />
              <Icon3D name="t-star-empty" size={56} className="cer-star-off" />
              <Icon3D name="t-star-half" size={56} className="cer-star-half" />
              <Icon3D name="t-star" size={56} className="cer-star-on" />
            </i>
          ))}
        </div>
        {/* The fuse: a recessed track, the gold fill, the comet orb and four segment ticks. */}
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

        {/* The records: their OWN amber glass card, only when the session set any. */}
        {records.length > 0 && (
          <article className="cer-card cer-records glass">
            <div className="cer-record">
              <span className="uv-well"><Icon3D name="t-record" size={40} /></span>
              <span>
                <span className="uv-eyebrow">Ez a tiéd mostantól</span>
                <strong>{records.length} új rekord</strong>
              </span>
            </div>
            {records.map((r, i) => (
              <div key={`${r.name}-${r.kind}-${i}`} className="cer-rec-row">
                <strong>{r.name}</strong>
                <span className="cer-vals">
                  <span className="cer-tchip">
                    <Icon3D name={RECORD_KIND_ICON[r.kind] ?? 't-record'} size={24} />
                    {r.kind}
                  </span>
                  {r.values.map((v) => <b key={v} className="is-lit">{v}</b>)}
                </span>
              </div>
            ))}
          </article>
        )}

        {/* ONE card for every other number: minutes + XP, the tally, the küldetések. */}
        <article className="cer-card cer-sum glass">
          {minutes != null || xpGained != null ? (
            <div className="cer-stats">
              {minutes != null && (
                <span>
                  <Icon3D name="t-clock" size={32} />
                  <span>
                    <strong>{minutes}<i>′</i></strong><small>a pulton töltött idő</small>
                  </span>
                </span>
              )}
              {xpGained != null && (
                <span>
                  <Icon3D name="t-coin" size={32} />
                  <span>
                    <strong>+{huNumber(xpGained)}</strong><small>szerzett XP</small>
                  </span>
                </span>
              )}
            </div>
          ) : null}
          <div className="cer-tally">
            <span>
              <Icon3D name="t-weight" size={24} />
              <b data-cer-count="sets">{counterValue(score.done.sets)}</b>
              <small>szett</small>
            </span>
            <span>
              <Icon3D name="t-dumbbell" size={24} />
              <b data-cer-count="reps">{counterValue(score.done.reps)}</b>
              <small>ismétlés</small>
            </span>
            <span>
              <Icon3D name="t-protocol" size={24} />
              <b data-cer-count="volume">{counterValue(score.done.volume, true)}</b>
              <small>kg × rep</small>
            </span>
          </div>
          {/* Owner-approved addition (mezo-me75u.4): the session's ACCEPTED challenges with
              their outcome, revealed on beat 3. The outcome is an icon with an accessible
              name — no outcome text, and a miss only dims (the report never punishes). */}
          {challenges.length > 0 && (
            <div className="cer-quests">
              <span className="uv-eyebrow">Küldetések · {hitCount} / {challenges.length}</span>
              {challenges.map((c) => {
                const out = CHALLENGE_OUTCOME[c.status]
                return (
                  <div key={c.id} className={`cer-quest is-${c.status}`}>
                    <span className="cer-quest-body">
                      {c.exercise && <strong>{c.exercise}</strong>}
                      <span className="cer-vals">
                        <span className="cer-tchip is-coral">
                          <Icon3D name={challengeTypeIcon(c.type)} size={24} />
                          {challengeTypeLabel(c.typeLabel)}
                        </span>
                        {targetChips(c.target).map((v, j) => <b key={`${v}-${j}`}>{v}</b>)}
                      </span>
                    </span>
                    <span className="cer-quest-res" role="img" aria-label={out.label}>
                      <Icon3D name={out.icon} size={30} />
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </article>
        {/* The honest tail: the close did not tick everything (prototype recap()). */}
        {pendingSets > 0 && (
          <p className="cer-recap-note">{pendingSets} szett kihagyott státusszal zárult.</p>
        )}
      </section>

      {/* The single way on — the prototype's only CTA on this screen. */}
      <div className="cer-foot">
        <div className="cer-cta">
          <button type="button" className="cer-go glass" onClick={() => setStep('details')}>
            <Icon3D name="t-journal" size={44} />
            <span>
              <strong>Részletek</strong>
              <small>Izomcsoportok és a nyert kalória</small>
            </span>
            <em aria-hidden="true">›</em>
          </button>
        </div>
      </div>
    </div>
  )
}
