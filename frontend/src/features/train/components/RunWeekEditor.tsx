// ============================================================
// Mezo · RunWeekEditor — presentational editor for ONE week of a running
// block's structure (props in, callback out — no hooks). Each prescribed
// session is its own numbered card: the plan-level weekday + time (constant across
// weeks), then the week-level load. Sprint = rounds + rest steppers; Piramis =
// tappable work-second tags.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `futasterv()` `sesCard`): a numbered
// section per session — „Nap · minden héten" as weekday pills, „Időpont · minden héten" as a
// time field, „Terhelés · N. hét" with the load controls, and the session's interval tube
// redrawn from the edited segments.
// ============================================================
import type { ReactNode } from 'react'
import { Card, EmptyTank, Input, Lab, Note, Section } from '@/shared/ui/folyadek'
import { CompactStepper } from '@/features/train/components/CompactStepper'
import { WeekdayGrid } from '@/features/train/components/WeekdayGrid'
import { IntervalTube } from '@/features/train/components/RunSessionCard'
import {
  sprintOf, pyramidOf, workSecs, restSec,
  setSprintRounds, setSprintRest, setPyramidWork,
  setSessionDay, setSessionTime,
} from '@/data/train/runningDraft'
import type { RunningBlockStructureDto, RunPrescribedSession } from '@/data/train/runningApi'

// 15 → 30 → 45 → 60 → 15 cycle for the pyramid segment tags.
const WORK_CYCLE = [15, 30, 45, 60]
const nextWork = (v: number) => WORK_CYCLE[(WORK_CYCLE.indexOf(v) + 1) % WORK_CYCLE.length] ?? 15

export function RunWeekEditor({ structure, weekNumber, onStructure, firstN = 3 }: {
  structure: RunningBlockStructureDto
  weekNumber: number
  onStructure: (s: RunningBlockStructureDto) => void
  /** The section number of the first session card (the builder's own sections come before it). */
  firstN?: number
}) {
  const week = structure?.weeks?.find((w) => w.weekNumber === weekNumber)
  if (!week) {
    return <Card><EmptyTank icon="t-calendar">Ez a hét nincs a tervben.</EmptyTank></Card>
  }
  const sprint = sprintOf(week)
  const pyramid = pyramidOf(week)

  return (
    <>
      {sprint && (
        <SessionCard n={firstN} session={sprint} structure={structure} weekNumber={weekNumber} onStructure={onStructure}>
          <div className="es-vl es-vl-flush">
            <CompactStepper label="kör" value={sprint.rounds ?? 0} step={1} integer
              onChange={(n) => onStructure(setSprintRounds(structure, weekNumber, n))} />
            <CompactStepper label="mp pihenő" value={restSec(sprint)} step={5} integer
              onChange={(n) => onStructure(setSprintRest(structure, weekNumber, n))} />
          </div>
        </SessionCard>
      )}
      {pyramid && (
        <SessionCard n={firstN + (sprint ? 1 : 0)} session={pyramid} structure={structure} weekNumber={weekNumber} onStructure={onStructure}>
          <PyramidTags values={workSecs(pyramid)} onChange={(arr) => onStructure(setPyramidWork(structure, weekNumber, arr))} />
          <Note>pihenő = szakasz × 2 · automatikus</Note>
        </SessionCard>
      )}
    </>
  )
}

function SessionCard({ n, session, structure, weekNumber, onStructure, children }: {
  n: number
  session: RunPrescribedSession
  structure: RunningBlockStructureDto
  weekNumber: number
  onStructure: (s: RunningBlockStructureDto) => void
  children: ReactNode
}) {
  const timeId = `es-time-${session.key}`
  return (
    <>
      <Section n={n} title={session.label} />
      <Card className="es-ses">
        {/* Menetrend — plan-level day + time */}
        <Lab>Nap · minden héten</Lab>
        <WeekdayGrid value={session.dayOfWeek} onChange={(d) => onStructure(setSessionDay(structure, session.key, d))} />
        <Lab htmlFor={timeId}>Időpont · minden héten</Lab>
        <Input
          id={timeId}
          type="time"
          aria-label={`${session.label} időpont`}
          value={session.timeOfDay ?? ''}
          onChange={(e) => onStructure(setSessionTime(structure, session.key, e.target.value))}
        />

        {/* Terhelés — week-level */}
        <Lab>Terhelés · {weekNumber}. hét</Lab>
        {children}
        <IntervalTube segments={session.segments} rounds={session.kind === 'sprint' ? session.rounds : null} />
      </Card>
    </>
  )
}

function PyramidTags({ values, onChange }: { values: number[]; onChange: (next: number[]) => void }) {
  const cycle = (i: number) => onChange(values.map((v, idx) => (idx === i ? nextWork(v) : v)))
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))
  const append = () => onChange([...values, 30])
  return (
    <div className="fo-tags es-pyr">
      {values.map((v, i) => (
        <span key={i} className="tx">
          <button type="button" aria-label={`${v} mp szakasz váltása`} onClick={() => cycle(i)}>{v} mp</button>
          <button type="button" aria-label={`${v} mp szakasz törlése`} onClick={() => remove(i)}>×</button>
        </span>
      ))}
      <span className="tx add"><button type="button" onClick={append}>＋ szakasz</button></span>
    </div>
  )
}
