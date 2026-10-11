// ============================================================
// Mezo · WorkoutBriefing (mezo-mgu2r; Folyadék: mezo-n4wf5.4) — the Eligazítás, the 'brief' phase of
// /train/session. A fresh start opens here (a resumed workout never does): the duration band, the
// counts, the niggle, the day's quests to opt into (pre-ticked by the owner-approved rule), the
// overload line, the exercise list, and the floating Indulás that starts the workout.
// Presentational only — ActiveWorkoutPage owns the state and the start.
// Build target: docs/design_2.0/prototypes/vilagos/edzes.js `indulas()` (`#w-edzes-indulas`).
// The route is chrome-free (no title bar is mounted), so the page draws the bar's sub-page row
// itself — the same recipe as SportLogPage's `TopRow`. CSS: folyadek-edzes-eligazitas.css (`.ei-`).
// ============================================================
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { Challenge, NiggleWarning, OverloadSummary } from '@/data/types'
import { ChallengeGenerationLoader } from '@/features/train/components/ChallengeGenerationLoader'
import { DeltaChip, Mchp, QuestTick, QuestType, QuestWhy, deepMuscle } from '@/features/train/components/folyadek'
import { WorkoutOverloadLine, overloadMoves } from '@/features/train/components/WorkoutOverloadLine'
import { challengeConfidenceLine, challengeTypeIcon, challengeTypeLabel, targetChips } from '@/features/train/logic/challengeDisplay'
import { Acts, Box, Btn, Bub, Caps, Card, EmptyTank, Facts, Hero, Lk, Note, Page, RangeBand, Row, Section } from '@/shared/ui/folyadek'

export interface BriefingExercise {
  id: string
  name: string
  muscle: string
  sets: number
  /** "105 × 10" — the first working set's prescription; null when the plan carries none. */
  goal: string | null
  chip: { text: string; tone: 'up' | 'hold' | 'down' } | null
  /** Why the target sits past the range top (reps before a too-big jump, mezo-bk7sn); else null. */
  why?: string | null
}

export interface WorkoutBriefingProps {
  title: string
  eyebrow: string
  /** The duration band; null while unknown (timing profile pending / nothing to estimate). */
  minutes: [number, number] | null
  exerciseCount: number
  setCount: number
  niggle: NiggleWarning | null | undefined
  challenges: Challenge[]
  pending: boolean
  failed: boolean
  onRetry?: () => void
  ticked: Record<string, boolean>
  onToggle: (id: string) => void
  overload: OverloadSummary | null | undefined
  exercises: BriefingExercise[]
  onBack: () => void
  onStart: () => void
  /** The kalauz ? — only when the route has a kalauz. */
  kalauzButton?: ReactNode
}

/** The quest type as the wording table names it (the wire label's own translation still says „PR-kísérlet"). */
const questTypeLabel = (label: string) => {
  const hu = challengeTypeLabel(label)
  return hu === 'PR-kísérlet' ? 'Rekord-kísérlet' : hu
}

/** The chip says the step, its colour says the direction — the arrow of the old skin is dropped. */
const chipText = (text: string) => text.replace(/^[↑↓]\s*/, '')

export function WorkoutBriefing({
  title, eyebrow, minutes, exerciseCount, setCount, niggle, challenges, pending, failed, onRetry,
  ticked, onToggle, overload, exercises, onBack, onStart, kalauzButton,
}: WorkoutBriefingProps) {
  const [openWhy, setOpenWhy] = useState<string | null>(null)
  const questsReady = !pending && !failed
  const tickedCount = questsReady ? challenges.filter((c) => ticked[c.id]).length : 0
  const questOn = (exerciseId: string) => questsReady && challenges.some((c) => ticked[c.id] && c.exerciseId === exerciseId)
  const moves = overloadMoves(overload)
  let n = 0

  return (
    <Page
      nonav
      className="ei-page"
      foot={(
        <Btn grow onClick={onStart}>
          {tickedCount > 0 ? `Indulás · ${tickedCount} küldetéssel` : 'Indulás küldetés nélkül'}
        </Btn>
      )}
    >
      <div className="ei-top" data-kalauz-anchor="session-start">
        <div className="fo-trow">
          <button type="button" className="fo-ib fo-back" aria-label="Vissza" onClick={onBack}><span aria-hidden="true">‹</span></button>
          <div className="fo-title">
            <small><i aria-hidden="true" /><span>{eyebrow}</span></small>
            <div className="fo-h sm"><h1>Eligazítás</h1>{kalauzButton}</div>
          </div>
        </div>
      </div>

      <Hero
        aria-label={`${title} · várható időtartam`}
        label="Várható idő"
        verdict={minutes ? `${minutes[0]}–${minutes[1]} perc, a saját tempód alapján.` : 'Még számolom, mennyi idő lesz.'}
      >
        {minutes ? <RangeBand lo={minutes[0]} hi={minutes[1]} unit="perc" /> : <RangeBand pending />}
        <Facts items={[[String(exerciseCount), 'gyakorlat'], [String(setCount), 'szett'], [String(tickedCount), 'küldetés']]} />
      </Hero>

      {niggle && (
        <Hero
          warn
          role="note"
          aria-label="Sérülés-figyelmeztetés"
          label="Figyelj rá"
          verdict={`${niggle.muscleLabel ?? 'Jobb váll'} aktív`}
          sub={niggle.detail || 'Óvatosan, először bemelegítés'}
          left={<Bub icon="t-bandage" size={58} color="var(--fo-warn)" />}
        />
      )}

      <Section n={++n} title="Küldetések · mit vállalsz ma?" />
      <Card aria-label="Küldetések">
        {pending ? (
          <ChallengeGenerationLoader />
        ) : failed ? (
          <>
            <Box icon="t-info" color="var(--fo-bad)" title="A küldetések nem jöttek le.">
              <p>Az edzés ettől még indulhat.</p>
            </Box>
            {onRetry && <Acts><Btn sm onClick={onRetry}>Újra</Btn></Acts>}
          </>
        ) : challenges.length === 0 ? (
          <EmptyTank icon="t-quest">Ma nincs küldetés — ehhez az edzéshez még kevés az előzmény.</EmptyTank>
        ) : (
          <>
            {challenges.map((c) => {
              const on = !!ticked[c.id]
              const why = openWhy === c.id
              const type = questTypeLabel(c.typeLabel)
              return [
                <Row
                  key={c.id}
                  className="ei-quest"
                  left={(
                    <QuestTick
                      on={on}
                      confidence={c.confidence}
                      label={`${c.exercise ?? type} · ${type}: ${on ? 'vállalva' : 'vállalom'}`}
                      onClick={() => onToggle(c.id)}
                    />
                  )}
                  title={c.exercise ?? type}
                  sub={(
                    <>
                      <QuestType icon={challengeTypeIcon(c.type)}>{type}</QuestType>{' '}
                      <b>{targetChips(c.target).join(' · ')}</b>
                      <br />
                      {challengeConfidenceLine(c.confidence, c.risk)}
                    </>
                  )}
                  right={(
                    <Lk aria-expanded={why} onClick={() => setOpenWhy(why ? null : c.id)}>
                      {why ? 'Kevesebb' : 'Miért?'}
                    </Lk>
                  )}
                />,
                why && <QuestWhy key={`${c.id}-why`} why={c.why} glory={c.glory} />,
              ]
            })}
            <Note>
              A kapszula annyira telik meg, amennyire biztos a küldetés; amelyiknél még tanulom, az üres marad. Az
              előre bepipáltakat javaslom. Passzolni ér — és edzés közben is elengedheted bármelyiket.
            </Note>
          </>
        )}
      </Card>

      {moves && (
        <>
          <Section n={++n} title="Ma itt lépünk előre" />
          <Card><WorkoutOverloadLine overload={overload} /></Card>
        </>
      )}

      <Section n={++n} title={`A mai sor · ${setCount} szett vár megtöltésre`} />
      <Card>
        {exercises.map((e) => (
          <Row
            key={e.id}
            left={<Mchp muscle={e.muscle} sm />}
            title={e.name}
            sub={(
              <>
                {e.sets} szett{e.goal ? ` · cél ${e.goal}` : ''}
                {e.chip && <> <DeltaChip tone={e.chip.tone}>{chipText(e.chip.text)}</DeltaChip></>}
                {e.why && <span className="ei-warn">{e.why}</span>}
              </>
            )}
            right={(
              <span className="ei-rr">
                {questOn(e.id) && (
                  <span className="ei-rq" role="img" aria-label="Van vállalt küldetés">
                    <Bub icon="t-quest" size={26} color="var(--fo-gold)" />
                  </span>
                )}
                <Caps n={e.sets} done={0} color={deepMuscle(e.muscle)} />
              </span>
            )}
          />
        ))}
      </Card>
    </Page>
  )
}
