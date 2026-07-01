// ============================================================
// Mezo · RunWeekEditor — presentational editor for ONE week of a running
// block's structure (props in, callback out — no hooks). Each prescribed
// session is a two-zone card: Menetrend (plan-level weekday grid + time,
// constant across weeks) and Terhelés (week-level load controls). Sprint =
// rounds + rest steppers; Piramis = tappable work-second pills. Accent --info.
// ============================================================
import { CompactStepper } from '@/features/train/components/CompactStepper'
import { WeekdayGrid } from '@/features/train/components/WeekdayGrid'
import {
  sprintOf, pyramidOf, workSecs, restSec,
  setSprintRounds, setSprintRest, setPyramidWork,
  setSessionDay, setSessionTime,
} from '@/data/train/runningDraft'
import type { RunningBlockStructureDto, RunPrescribedSession } from '@/data/train/runningApi'

const RUN = 'var(--info)'

// 15 → 30 → 45 → 60 → 15 cycle for the pyramid segment pills.
const WORK_CYCLE = [15, 30, 45, 60]
const nextWork = (v: number) => WORK_CYCLE[(WORK_CYCLE.indexOf(v) + 1) % WORK_CYCLE.length] ?? 15

const hintStyle: React.CSSProperties = { fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }

export function RunWeekEditor({ structure, weekNumber, onStructure }: {
  structure: RunningBlockStructureDto
  weekNumber: number
  onStructure: (s: RunningBlockStructureDto) => void
}) {
  const week = structure?.weeks?.find((w) => w.weekNumber === weekNumber)
  if (!week) {
    return <span className="text-tertiary" style={{ fontSize: 11, fontStyle: 'italic' }}>Ez a hét nincs a tervben.</span>
  }
  const sprint = sprintOf(week)
  const pyramid = pyramidOf(week)

  return (
    <div className="col gap-md">
      {sprint && (
        <SessionCard session={sprint} structure={structure} weekNumber={weekNumber} onStructure={onStructure}>
          <div className="row gap-sm">
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
          <span style={{ ...hintStyle, marginTop: 4 }}>pihenő = szakasz × 2 · automatikus</span>
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
    <div className="card notch-4 col" style={{ padding: 12, gap: 9, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: RUN }} />
      <span className="label-mono" style={{ color: RUN }}>{session.label}</span>

      {/* Menetrend — plan-level day + time */}
      <span style={hintStyle}>Nap · minden héten</span>
      <WeekdayGrid value={session.dayOfWeek} onChange={(d) => onStructure(setSessionDay(structure, session.key, d))} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <span style={hintStyle}>Időpont · minden héten</span>
        <input
          type="time"
          aria-label={`${session.label} időpont`}
          value={session.timeOfDay ?? ''}
          onChange={(e) => onStructure(setSessionTime(structure, session.key, e.target.value))}
          style={{ background: 'var(--surface-2)', border: '1px solid color-mix(in srgb, var(--info) 30%, transparent)', color: RUN, fontFamily: 'var(--ff-mono)', fontSize: 13, fontWeight: 600, padding: '6px 10px' }}
        />
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '3px 0' }} />

      {/* Terhelés — week-level */}
      <span style={hintStyle}>Terhelés · {weekNumber}. hét</span>
      {children}
    </div>
  )
}

function PyramidPills({ values, onChange }: { values: number[]; onChange: (next: number[]) => void }) {
  const cycle = (i: number) => onChange(values.map((v, idx) => (idx === i ? nextWork(v) : v)))
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))
  const append = () => onChange([...values, 30])
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      {values.map((v, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 600, padding: '5px 8px', borderRadius: 2, color: RUN, border: '1px solid color-mix(in srgb, var(--info) 35%, transparent)', background: 'color-mix(in srgb, var(--info) 8%, transparent)' }}>
          <button type="button" aria-label={`${v} mp szakasz váltása`} onClick={() => cycle(i)} style={{ color: 'inherit' }}>{v}</button>
          <button type="button" aria-label={`${v} mp szakasz törlése`} onClick={() => remove(i)} style={{ color: 'var(--text-tertiary)', fontSize: 11, lineHeight: 1 }}>×</button>
        </span>
      ))}
      <button type="button" onClick={append} style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 600, padding: '5px 8px', borderRadius: 2, color: RUN, border: '1px dashed color-mix(in srgb, var(--info) 45%, transparent)', background: 'transparent' }}>＋ szakasz</button>
    </div>
  )
}
