// ============================================================
// Mezo · RunWeekEditor — presentational editor for ONE week of a running
// block's structure (props in, callback out — no hooks). Each prescribed
// session is a two-zone card: Menetrend (plan-level weekday grid + time,
// constant across weeks) and Terhelés (week-level load controls). Sprint =
// rounds + rest steppers; Piramis = tappable work-second pills. Accent --sky.
// Üveg re-dress (mezo-me75u.4, prototype uveg-edzes-body.html `futasterv()` `.wkrow`):
// it renders inside the builder's sky glass form, so every session card is a FLAT row
// and the segment pills flat chips (never glass in glass); styles live in the
// `uveg edzes sport` block of prototype.css, scoped to `.uvs-rbb`.
// ============================================================
import { CompactStepper } from '@/features/train/components/CompactStepper'
import { WeekdayGrid } from '@/features/train/components/WeekdayGrid'
import {
  sprintOf, pyramidOf, workSecs, restSec,
  setSprintRounds, setSprintRest, setPyramidWork,
  setSessionDay, setSessionTime,
} from '@/data/train/runningDraft'
import type { RunningBlockStructureDto, RunPrescribedSession } from '@/data/train/runningApi'

// 15 → 30 → 45 → 60 → 15 cycle for the pyramid segment pills.
const WORK_CYCLE = [15, 30, 45, 60]
const nextWork = (v: number) => WORK_CYCLE[(WORK_CYCLE.indexOf(v) + 1) % WORK_CYCLE.length] ?? 15

export function RunWeekEditor({ structure, weekNumber, onStructure }: {
  structure: RunningBlockStructureDto
  weekNumber: number
  onStructure: (s: RunningBlockStructureDto) => void
}) {
  const week = structure?.weeks?.find((w) => w.weekNumber === weekNumber)
  if (!week) {
    return <p className="uvs-wked-none uv-empty">Ez a hét nincs a tervben.</p>
  }
  const sprint = sprintOf(week)
  const pyramid = pyramidOf(week)

  return (
    <div className="uvs-wked">
      {sprint && (
        <SessionCard session={sprint} structure={structure} weekNumber={weekNumber} onStructure={onStructure}>
          <div className="uvs-wked-steps">
            <CompactStepper label="kör" value={sprint.rounds ?? 0} step={1} integer
              onChange={(n) => onStructure(setSprintRounds(structure, weekNumber, n))} />
            <CompactStepper label="mp pihenő" value={restSec(sprint)} step={5} integer
              onChange={(n) => onStructure(setSprintRest(structure, weekNumber, n))} />
          </div>
        </SessionCard>
      )}
      {pyramid && (
        <SessionCard session={pyramid} structure={structure} weekNumber={weekNumber} onStructure={onStructure}>
          <PyramidPills values={workSecs(pyramid)} onChange={(arr) => onStructure(setPyramidWork(structure, weekNumber, arr))} />
          <span className="uvs-hint">pihenő = szakasz × 2 · automatikus</span>
        </SessionCard>
      )}
    </div>
  )
}

function SessionCard({ session, structure, weekNumber, onStructure, children }: {
  session: RunPrescribedSession
  structure: RunningBlockStructureDto
  weekNumber: number
  onStructure: (s: RunningBlockStructureDto) => void
  children: React.ReactNode
}) {
  return (
    <div className="uvs-wkrow">
      <span className="uvs-wkrow-title">{session.label}</span>

      {/* Menetrend — plan-level day + time */}
      <span className="uvs-hint">Nap · minden héten</span>
      <WeekdayGrid value={session.dayOfWeek} onChange={(d) => onStructure(setSessionDay(structure, session.key, d))} />
      <div className="uvs-wkrow-time">
        <span className="uvs-hint">Időpont · minden héten</span>
        <input
          type="time"
          className="uvs-inp"
          aria-label={`${session.label} időpont`}
          value={session.timeOfDay ?? ''}
          onChange={(e) => onStructure(setSessionTime(structure, session.key, e.target.value))}
        />
      </div>

      <div className="uvs-wkrow-rule" aria-hidden="true" />

      {/* Terhelés — week-level */}
      <span className="uvs-hint">Terhelés · {weekNumber}. hét</span>
      {children}
    </div>
  )
}

function PyramidPills({ values, onChange }: { values: number[]; onChange: (next: number[]) => void }) {
  const cycle = (i: number) => onChange(values.map((v, idx) => (idx === i ? nextWork(v) : v)))
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))
  const append = () => onChange([...values, 30])
  return (
    <div className="uvs-chips">
      {values.map((v, i) => (
        <span key={i} className="uvs-chip is-work">
          <button type="button" aria-label={`${v} mp szakasz váltása`} onClick={() => cycle(i)}>{v}</button>
          <button type="button" className="uvs-chip-x" aria-label={`${v} mp szakasz törlése`} onClick={() => remove(i)}>×</button>
        </span>
      ))}
      <button type="button" className="uvs-chip is-add" onClick={append}>＋ szakasz</button>
    </div>
  )
}
