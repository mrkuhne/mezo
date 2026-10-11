// ============================================================
// Mezo · TrainWeekMapPage („Izomtérkép") — Terhelés subpage, Folyadék face (mezo-n4wf5.3,
// slice F3). Prototype: docs/design_2.0/prototypes/vilagos/edzes.js `terkep()` (route
// `#w-edzes-terkep`, args `terv` / `megvan` / `ures` / `tolt`), sheet `info` (arg `terkep`).
//
// The doorway from TrainWeekPage lands here with the SAME `doneRows`/`heatRows` split it
// itself reads (loadWeek.ts header note) — this page just draws more of it: the body from
// both sides as a vessel, a mode toggle that re-pours the SAME heat (never re-derives it
// from scratch), the untouched-group list, the sport-reach note and the doorway to every
// muscle sign. The mode toggle changes the liquid ONLY:
//   · „Eddig megvolt" — mapWeekHeat(doneRows, heatRows), the honesty cut (an 'over' status
//     must come from LOGGED work, never tonight's unlogged plan). The whole plan stands in
//     pale liquid; the logged work rises in it, deep.
//   · „A heti terv" — mapHeat(heatRows, 'planned'), the plan's own bucket per group: the
//     more the week asks, the fuller.
// The levels are the live logic's (loadLiquid.ts HEAT_FILL), not the prototype's
// done/planned approximation; the key under the body names each group with its real numbers
// and the WORD of its real level ('entering' is still below the floor in logged work, so it
// reads „elkezdted").
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useRunning, useWeekMuscleLog } from '@/data/hooks'
import {
  Card, FrameBack, Hero, Legend, Note, Page, Row, Section, Seg, Txt, useFrameTitle,
} from '@/shared/ui/folyadek'
import { DuoBody, Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { InfoButton } from '@/features/train/components/InfoButton'
import { weekZoneRows } from '@/features/train/logic/weekZone'
import { loadGroups, mapHeat, mapWeekHeat, sportReach, untouchedMuscles } from '@/features/train/logic/loadWeek'
import { HEAT_WORD, heatEntries } from '@/features/train/logic/loadLiquid'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'
import { LIVE_MUSCLES } from '@/features/train/logic/muscleColors'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import TrainWeekSkeleton, { TerhelesNoPlan } from '@/features/train/pages/TrainWeekSkeleton'

type MapMode = 'done' | 'planned'

const MODES: { key: MapMode; label: string }[] = [
  { key: 'done', label: 'Eddig megvolt' },
  { key: 'planned', label: 'A heti terv' },
]

export function TrainWeekMapPage() {
  const { sport, activeMeso, workoutPending, workout, completedTodayWorkout } = useTrain()
  const { activeRunningBlock, runningPending } = useRunning()
  const weekLog = useWeekMuscleLog()
  const navigate = useNavigate()
  const [mode, setMode] = useState<MapMode>('done')
  useFrameTitle({ title: 'Izomtérkép', eyebrow: 'Terhelés' })

  const back = <FrameBack history fallback="/train/week" label="Vissza: Terhelés" className="fo-backpill">‹ Terhelés</FrameBack>

  if (workoutPending || runningPending || weekLog.pending) return <TrainWeekSkeleton blocks={[430, 90, 90]} />

  if (!activeMeso) {
    return <TerhelesNoPlan label="Izomtérkép" verdict="Az izomtérkép itt jelenik majd meg." back={back} />
  }

  const days = activeMeso.days ?? []
  const sportSlots = sport.schedule?.volleyball.sessions ?? []
  const runSessions: RunPrescribedSession[] = activeRunningBlock
    ? (activeRunningBlock.structure.weeks[activeRunningBlock.currentWeek - 1]?.sessions ?? [])
    : []

  // Same two row sets TrainWeekPage itself reads (loadWeek.ts header note): `doneRows` is
  // the week as LOGGED, `heatRows` adds tonight's plan so 'entering' is reachable.
  const doneRows = weekZoneRows({ plannedDays: days, completed: weekLog.details })
  const todayPlan = !completedTodayWorkout && workout
    ? workout.exercises.map((e) => ({
      muscle: e.muscle, type: e.type, workingSets: e.workingSets, targetRIR: e.targetRIR,
    }))
    : null
  const heatRows = weekZoneRows({ plannedDays: days, completed: weekLog.details, todayPlan })

  const doneHeat = mapWeekHeat(doneRows, heatRows)
  const heat = mode === 'done' ? doneHeat : mapHeat(heatRows, 'planned')
  // mapWeekHeat keeps heatRows' order, so the level of a group is the heat row at its index.
  const levelOf = new Map(heatRows.map((r, i) => [r.group, doneHeat[i]?.level ?? 'none'] as const))
  const groups = loadGroups(doneRows)
  const waiting = untouchedMuscles(doneRows)
  const plannedSets = doneRows.reduce((t, r) => t + r.plannedSets, 0)
  const reach = sportReach(sportLoadForWeek(sportSlots, runSessions))
  const planned = mode === 'planned'

  const allReached = 'Minden izomcsoportod sorra került ezen a héten.'
  const verdict = plannedSets === 0
    ? 'Ezen a héten még nincs betervezett szett.'
    : planned
      ? `${plannedSets} szettet kér tőled ez a hét.`
      : waiting.length > 0 ? `${waiting.length} izomcsoport még munkára vár ezen a héten.` : allReached
  // the numbered drops count only the sections this week actually has
  const nWait = plannedSets > 0 ? 1 : 0
  const nSport = nWait + (reach.length > 0 ? 1 : 0)

  return (
    <Page className="et-page">
      {back}
      <Hero
        className="et-maphero"
        label={planned ? 'Izomtérkép · a heti terv' : 'Izomtérkép · eddig megvolt'}
        verdict={verdict}
        sub={planned
          ? 'Minél többet kér a hét egy izomtól, annál teltebb.'
          : 'Amit már megmozgattál, sötétebben telik — ami még vár, az halvány marad.'}
        actions={(
          <InfoButton
            eyebrow="Izomtérkép"
            title="Miből rajzoljuk?"
            copy="A futó terved e heti szettjeiből: minden izom annyira telik, amennyi a heti munkájából már megvan. A terv nézet azt festi fel, mit kér a hét — ott a teltebb izom többet kérő izmot jelent."
          />
        )}
      >
        <Seg className="et-modes" aria-label="Nézet" items={MODES} value={mode} onChange={setMode} />
        <span className="et-map" data-mode={mode} data-heat={heat.map((h) => `${h.token}:${h.level}`).join(' ')}>
          <DuoBody entries={heatEntries(heat, mode)} size="xl" ariaLabel="Elöl és hátul: a heti terhelésed" />
        </span>
        <div className="et-sides" aria-hidden="true"><span>elölről</span><span>hátulról</span></div>
        <Legend
          center
          className="et-key"
          items={groups.map((g) => ({
            color: deepMuscle(g.colorMuscle),
            label: planned
              ? <>{g.label} <b>{g.plannedSets}</b></>
              : <>{g.label} <b>{g.doneSets}/{g.plannedSets}</b> {HEAT_WORD[levelOf.get(g.group) ?? 'none']}</>,
          }))}
        />
        <Note>
          {planned
            ? 'Minél többet kér a hét, annál teltebb az izom.'
            : 'Négy állapot: még vár · elkezdted · jó úton · megvan. A szín az izomcsoporté, nem ítélet.'}
        </Note>
      </Hero>

      {plannedSets > 0 && (
        <>
          <Section n={nWait} title="Még munkára vár" />
          <Card className="et-wait">
            {waiting.length > 0
              ? waiting.map((r) => (
                <Row key={r.label} left={<Mchp muscle={r.colorMuscle} sm />} title={r.label} sub={`${r.plannedSets} szett vár a héten`} />
              ))
              : <Txt>{allReached}</Txt>}
          </Card>
        </>
      )}

      {reach.length > 0 && (
        <>
          <Section n={nSport} title="A sport is dolgozott" />
          <Card>
            <Row
              icon="t-volley"
              title={`A sport ezeket is dolgoztatta: ${reach.join(', ')}.`}
              sub="Becslés, nem mérés — a szettszámokba nem számít bele."
            />
          </Card>
        </>
      )}

      <Section n={nSport + 1} title="Mélyebben" />
      <Card>
        <Row
          icon="t-pattern"
          title="Minden izomjel"
          sub={`A ${LIVE_MUSCLES.length} izom, saját jellel, régiónként`}
          onClick={() => navigate('/train/week/jelek')}
        />
      </Card>
    </Page>
  )
}
