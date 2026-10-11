// ============================================================
// Mezo · WorkoutCeremony — the TWO-STEP workout-close ceremony (mezo-e1ii9, T3)
//
// The PATTERN is the ceremony pattern's (docs/design_2.0/2026-09-15-ceremony-pattern.md): two
// SCREENS, one choreography played exactly once, every number a prop. The MATERIAL is Folyadék
// (mezo-n4wf5.4, prototype vilagos/edzes.js `cer()` — routes `cer`, `cer.allo`, `cer.csendes`,
// `cer.reszletek`, `.keret-nincs`, `.kcal-nincs`):
//
//   Step 1 — the title row (the route is chrome-free, so the screen draws it) → the stage: five
//     stars over a CUP that fills to the score; what spills over the rim is the record
//     (`CupStage spill`). With the verdict (beat 1) comes „Ez a tiéd mostantól · N új rekord" (a
//     gold card of record capsules, only when there are records); with beat 2 „A mai számok":
//     minutes / XP / kcal — each only when known — and the szett / ismétlés / kg × ism tally,
//     then „Küldetések · hit / all" with the outcome as a capsule + a pill, and the honest
//     pending-sets line. Exactly ONE way on: `Részletek`.
//   Step 2 — „Részletek": the kcal hero (the day's bowl with today's movement poured on top; the
//     whole hero opens Fuel), „A mai edzésen · izomcsoportok" (one row per muscle with its own
//     stars), „Hogy ment?" (the closing note, in flow ABOVE the floating button so the keyboard
//     pushes the button instead of covering it), then the way out and `Vissza az értékeléshez`.
//
// The pass is the kit's ONE rAF pass (`useCeremonyPass`): it writes `--p`, the star classes, the
// counters and the beats itself — never a CSS transition (a throttled webview freezes one at 0).
// `reducedMotion` (defaults to the media query) and `settled` paint the end state on the FIRST
// render. A trip to step 2 and back comes back settled (the prototype's `cer.allo`): the pass
// that owned step one's nodes stopped when they left the DOM, and it never replays.
//
// Every number is a prop: this component computes nothing and fabricates nothing. A value whose
// input is unknown is not rendered — never a 0 (minutes, XP, kcal). The one thing it reads
// itself is the Fuel day's frame for the bowl, in a small child on step 2 only.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Challenge } from '@/data/types'
import type { Medal } from '@/data/train/medalTypes'
import { useFuelDay } from '@/data/fuel/fuelHooks'
import { verdictFor, type CerScore, type MuscleStarRow as MuscleStars } from '@/features/train/logic/cerScore'
import { MEDAL_TYPE_LABEL, formatMedalNumber, medalPreviousShare } from '@/features/train/logic/medalLabels'
import { challengeTypeLabel, targetChips } from '@/features/train/logic/challengeDisplay'
import { KcalBowl, MuscleStarRow, QuestCapsule, QuestType, Rcap, StarRow, kcalBowlShares } from '@/features/train/components/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import {
  Btn, Bub, Card, CeremonyCount, CeremonyReveal, CeremonyRoot, CupStage, Facts, FootCol, Hero, Legend, Lk, Note, Page, Row,
  Section, St, TextArea, TitleRow, ratioStars, useCeremonyPass,
} from '@/shared/ui/folyadek'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

/** One record row of the step-one records card: the exercise, the medal type label
 *  (MEDAL_TYPE_LABEL) and the plain achieved values as chips ('105 kg', '10 ism.'). */
export interface CeremonyRecord { name: string; kind: string; values: string[]
  /** Where the OLD record stood inside the new one, in % (`medalPreviousShare`) — the dashed line of the
   *  Folyadék record capsule (`Rcap prev`). Absent when the medal carries no comparable previous value. */
  prevShare?: number }

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
  return { name: m.exerciseName, kind: MEDAL_TYPE_LABEL[m.type] ?? m.type, values, prevShare: medalPreviousShare(m) ?? undefined }
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
  /** Not drawn any more: the Folyadék stage's overline is „Így sikerült · N csillag az ötből" and the title row says
   *  „Edzés lezárva". Still accepted so the page compiles unchanged; drop it at the call site. */
  eyebrow?: string
  /** The title row's context line — the workout's own name and day („Pull Day · szept 24."). OPTIONAL: without it
   *  the row says „Edzés · ma". */
  context?: string
  /** MEASURED minutes only; null hides the value (no fabricated estimate — see the page). */
  minutes: number | null
  /** The finish response's real XP; null hides the value. */
  xpGained: number | null
  /** The RECORD-tier medals earned this session, as rows (see `ceremonyRecord`). */
  records: CeremonyRecord[]
  /** The session's ACCEPTED challenges with their outcome (see `ceremonyChallenges`);
   *  empty/absent hides the Küldetések section. */
  challenges?: CeremonyChallenge[]
  muscles: MuscleStars[]
  /** The T5 `trainDayEnergy` estimate; null hides it on both steps (never a 0 kcal). */
  kcal: { value: number; known: true } | null
  /** The day's own kcal frame for the bowl on step 2. OPTIONAL test / caller seam: leave it out and the details step
   *  reads the Fuel day itself (`useFuelDay().fuel.energy?.baseKcal`); pass a number or `null` (= no frame) to skip the read. */
  dayKcal?: number | null
  /** The closing-note draft, owned by the page. */
  note: string
  onNote(v: string): void
  /** The way out: straight to Mai. */
  onClose(): void
  onGoFuel(): void
  /** Recap mode: paint the final state, no pass. */
  settled?: boolean
  /** How many sets the close left pending; >0 adds the honest note. */
  pendingSets?: number
  /** Test seam; defaults to `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}

/** hu-HU grouping, with the locale's (narrow) no-break spaces normalised to a plain space. */
function huNumber(n: number): string {
  return Math.round(n).toLocaleString('hu-HU').replace(/[\u00a0\u202f]/g, ' ')
}

/** '4,5' — the Hungarian decimal comma, without depending on the runtime's ICU data. */
function huStars(stars: number): string {
  return String(stars).replace('.', ',')
}

/** Record type label → its glyph (the medal type, not a generic medal). */
const RECORD_KIND_ICON: Record<string, Icon3DName> = {
  'Súly-rekord': 't-weight', 'Rep-rekord': 't-repeat', '1RM-rekord': 't-ring', 'Volumen-rekord': 't-protocol',
}
/** A quest's outcome as its pill. A miss stays quiet — the closing screen never punishes. */
const CHALLENGE_OUTCOME: Record<CeremonyChallenge['status'], { label: string; tone: 'ok' | 'q' }> = {
  hit: { label: 'teljesült', tone: 'ok' },
  miss: { label: 'nem jött össze', tone: 'q' },
  inconclusive: { label: 'nem értékelhető', tone: 'q' },
}

/** Step two's hero when the workout earned kcal: the bowl of the day with today's movement on top — or, without the
 *  day's frame, only the bowl glyph and the number. The whole hero opens Fuel (the link inside is its button). */
function KcalHero({ kcal, dayKcal, stars, verdict, onGoFuel }: {
  kcal: number; dayKcal: number | null; stars: number; verdict: string; onGoFuel: () => void
}) {
  const shares = kcalBowlShares(dayKcal, kcal)
  return (
    <Hero
      className="ec-kc"
      data-frame={shares ? 'known' : 'none'}
      label="A mai mozgással"
      verdict={`+${huNumber(kcal)} kcal került a mai keretedbe.`}
      sub="Ennyit nyertél a mai mozgással · becslés, nem mérés."
      left={shares ? <KcalBowl base={shares.base} add={shares.add} /> : <Bub icon="t-bowl" size={64} color="var(--fo-gold)" />}
      onClick={onGoFuel}
      actions={<Lk>Megnézem a Fuelben</Lk>}
    >
      {shares && dayKcal != null && (
        <Legend items={[
          { label: <><b>{huNumber(dayKcal)} kcal</b> a napi kereted</>, color: 'color-mix(in srgb, #149E6E 50%, #fff)' },
          { label: <><b>+{huNumber(kcal)} kcal</b> a mai edzés</>, color: 'var(--fo-gold)' },
        ]} />
      )}
      <div className="ec-ms"><StarRow stars={stars} /><span>{verdict}</span></div>
    </Hero>
  )
}

/** The same hero, reading the day's frame from the Fuel day itself. Mounted on step two only, so step one never waits
 *  on it. No frame (a static target), still loading or failed → the no-frame face. */
function FuelFramedKcalHero(p: { kcal: number; stars: number; verdict: string; onGoFuel: () => void }) {
  const { fuel, isPending, isError } = useFuelDay()
  const frame = isPending || isError ? null : fuel.energy?.baseKcal ?? null
  return <KcalHero {...p} dayKcal={frame} />
}

export function WorkoutCeremony({
  score, context, minutes, xpGained, records, challenges = [], muscles, kcal, dayKcal,
  note, onNote, onClose, onGoFuel, settled = false, pendingSets = 0, reducedMotion,
}: WorkoutCeremonyProps) {
  const pass = useCeremonyPass({ ratio: score.ratio, settled, reducedMotion })
  const [step, setStep] = useState<'summary' | 'details'>('summary')
  // Once step two was opened, step one is a re-entry: it comes back settled (prototype `cer.allo`). The pass that
  // owned its nodes stopped when they left the DOM mid-flight, so React must paint the FINAL numbers there.
  const [revisited, setRevisited] = useState(false)
  const shown = revisited ? { ...pass, told: true, instant: true } : pass
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The title is where each step starts, for a screen reader and for the keyboard.
  useEffect(() => { headingRef.current?.focus() }, [step])

  const verdict = verdictFor(score.stars)
  const stars = ratioStars(score.ratio)

  // ---------- step two: what the session did, the note, and the way out ----------
  if (step === 'details') {
    let n = 0
    return (
      // The `key` is load-bearing: both steps return a `Page` at the same position, and React would otherwise REUSE
      // step one's DOM nodes (the ceremony root included) for step two's — leaving a still-running pass writing here.
      <Page
        key="details" nonav className="ec-page ec-details"
        foot={(
          <FootCol>
            <Btn onClick={onClose}>Vissza a mai napra · lezárva és elmentve</Btn>
            <Lk onClick={() => setStep('summary')}>Vissza az értékeléshez</Lk>
          </FootCol>
        )}
      >
        <TitleRow
          context={`Edzés lezárva · ${verdict}`} title="Részletek" backLabel="Vissza"
          onBack={() => setStep('summary')} headingRef={headingRef}
        />
        {kcal ? (
          dayKcal !== undefined
            ? <KcalHero kcal={kcal.value} dayKcal={dayKcal} stars={stars} verdict={verdict} onGoFuel={onGoFuel} />
            : <FuelFramedKcalHero kcal={kcal.value} stars={stars} verdict={verdict} onGoFuel={onGoFuel} />
        ) : (
          <Hero className="ec-quiet" label="Így sikerült" verdict={verdict} sub={`${huStars(score.stars)} csillag az ötből.`}>
            <div className="ec-ms"><StarRow stars={stars} /></div>
          </Hero>
        )}

        {muscles.length > 0 && (
          <>
            <Section n={++n} title="A mai edzésen · izomcsoportok" />
            <Card className="ec-muscles">
              {muscles.map((row) => (
                <MuscleStarRow key={row.muscle} muscle={row.muscle} label={row.label} ratio={row.ratio} done={row.done} plan={row.plan} />
              ))}
              <Note>A csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem gépi értékelés.</Note>
            </Card>
          </>
        )}

        {/* The closing note (mezo-d20.8.2.2) travels with the way out — the draft is the page's, and the page
            guarantees the save on both exits AND on unmount. */}
        <Section n={++n} title="Hogy ment?" />
        <Card className="ec-note">
          <VoiceField domain="train" onTranscript={(t) => onNote(appendDictation(note, t, 1000))}>
            <TextArea
              maxLength={1000} rows={3} value={note} aria-label="Hogy ment?"
              placeholder="Pl. rosszul aludtam, de a húzódzkodás jól ment…"
              onChange={(e) => onNote(e.target.value)}
            />
          </VoiceField>
          <Note>Nem kötelező — később is hozzáírhatod. Magától mentjük, amikor kilépsz.</Note>
        </Card>
        {muscles.length === 0 && (
          <Note>A csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem gépi értékelés.</Note>
        )}
      </Page>
    )
  }

  const hitCount = challenges.filter((c) => c.status === 'hit').length
  // Each only when known: an estimate is never printed as a measurement, an unknown never as 0.
  const top: [ReactNode, ReactNode][] = []
  if (minutes != null) top.push([`${minutes}′`, 'a pulton töltött idő'])
  if (xpGained != null) top.push([`+${huNumber(xpGained)}`, 'szerzett XP'])
  if (kcal) top.push([`+${huNumber(kcal.value)}`, 'kcal · becslés'])
  let n = 0

  // ---------- step one: the ceremony owns the screen, and ends with the one way on ----------
  return (
    <Page
      key="summary" nonav className="ec-page ec-summary"
      foot={(
        <Btn grow onClick={() => { setRevisited(true); setStep('details') }}>
          {kcal ? 'Részletek · izmok és a nyert kalória' : 'Részletek · izomcsoportok'}
        </Btn>
      )}
    >
      <TitleRow
        context={context ?? 'Edzés · ma'} title="Edzés lezárva" backLabel="Bezárás"
        onBack={onClose} headingRef={headingRef}
      />
      <CeremonyRoot pass={shown} className="ec-cer">
        <CupStage pass={shown} spill={records.length > 0} label={`Így sikerült · ${huStars(score.stars)} csillag az ötből`}>
          <CeremonyReveal beat={1}>
            <p className="fo-hero-verdict">{verdict}</p>
            <p className="fo-hero-sub">
              A kehely a tervedhez mérve telt meg{records.length > 0 ? ' — ami kicsordult, az új rekord' : ''}.
            </p>
          </CeremonyReveal>
        </CupStage>

        {/* The records: their OWN gold card, only when the session set any. */}
        {records.length > 0 && (
          <CeremonyReveal beat={1} className="ec-records">
            <Section n={++n} title={`Ez a tiéd mostantól · ${records.length} új rekord`} />
            <Card gold>
              {records.map((r, i) => (
                <Row
                  key={`${r.name}-${r.kind}-${i}`}
                  left={<Rcap prev={r.prevShare} />}
                  title={r.name}
                  sub={<QuestType icon={RECORD_KIND_ICON[r.kind] ?? 't-record'} color="var(--fo-gold)">{r.kind}</QuestType>}
                  value={<>{r.values[0]}{r.values[1] && <> <small>{r.values[1]}</small></>}</>}
                />
              ))}
            </Card>
          </CeremonyReveal>
        )}

        <CeremonyReveal beat={2} className="ec-numbers">
          <Section n={++n} title="A mai számok" />
          <Card>
            {top.length > 0 && <Facts className="ec-top-facts" items={top} />}
            <Facts
              className="ec-tally"
              items={[
                [<CeremonyCount key="s" pass={shown} value={score.done.sets} />, 'szett'],
                [<CeremonyCount key="r" pass={shown} value={score.done.reps} />, 'ismétlés'],
                [<CeremonyCount key="v" pass={shown} value={score.done.volume} />, 'kg × ism'],
              ]}
            />
          </Card>
          {/* The session's ACCEPTED quests with their outcome: a capsule that is full when it came through, and the
              outcome in words at the row's end. */}
          {challenges.length > 0 && (
            <>
              <Section n={++n} title={`Küldetések · ${hitCount} / ${challenges.length}`} />
              <Card className="ec-quests">
                {challenges.map((c) => {
                  const out = CHALLENGE_OUTCOME[c.status]
                  const line = `${challengeTypeLabel(c.typeLabel)} · ${targetChips(c.target).join(' · ')}`
                  return (
                    <Row
                      key={c.id}
                      data-outcome={c.status}
                      left={<QuestCapsule on={c.status === 'hit'} full />}
                      title={c.exercise ?? line}
                      sub={c.exercise ? line : undefined}
                      right={<St tone={out.tone}>{out.label}</St>}
                    />
                  )
                })}
              </Card>
            </>
          )}
          {/* The honest tail: the close did not tick everything. */}
          {pendingSets > 0 && <Note className="ec-pending">{pendingSets} szett kihagyott státusszal zárult.</Note>}
        </CeremonyReveal>
      </CeremonyRoot>
    </Page>
  )
}
