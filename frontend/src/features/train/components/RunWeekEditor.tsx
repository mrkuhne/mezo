// ============================================================
// Mezo · RunWeekEditor — presentational editor for ONE week of a running
// block's structure (props in, callback out — no hooks). Renders the Kedd
// Sprint (rounds + rest steppers) and Péntek Piramis (tappable work-second
// pills + "＋ szakasz") for the given weekNumber. Accent --info (run).
// Ported from the futas-blocks-builder mockup (RIGHT phone, expanded week).
// ============================================================
import { CompactStepper } from './CompactStepper'
import {
  sprintOf, pyramidOf, workSecs, restSec,
  setSprintRounds, setSprintRest, setPyramidWork,
} from '@/data/runningDraft'
import type { RunningBlockStructureDto } from '@/lib/runningApi'

const RUN = 'var(--info)'

// 15 → 30 → 45 → 60 → 15 cycle for the pyramid segment pills.
const WORK_CYCLE = [15, 30, 45, 60]
const nextWork = (v: number) => WORK_CYCLE[(WORK_CYCLE.indexOf(v) + 1) % WORK_CYCLE.length] ?? 15

export function RunWeekEditor({
  structure,
  weekNumber,
  onStructure,
}: {
  structure: RunningBlockStructureDto
  weekNumber: number
  onStructure: (s: RunningBlockStructureDto) => void
}) {
  const week = structure?.weeks?.find((w) => w.weekNumber === weekNumber)
  if (!week) {
    return (
      <span className="text-tertiary" style={{ fontSize: 11, fontStyle: 'italic' }}>
        Ez a hét nincs a tervben.
      </span>
    )
  }

  const sprint = sprintOf(week)
  const pyramid = pyramidOf(week)

  return (
    <div className="col gap-md">
      {/* Kedd · Sprint */}
      {sprint && (
        <div className="col gap-sm">
          <span className="label-mono" style={{ color: RUN }}>Kedd · Sprint</span>
          <div className="row gap-sm">
            <CompactStepper
              label="kör"
              value={sprint.rounds ?? 0}
              step={1}
              integer
              onChange={(n) => onStructure(setSprintRounds(structure, weekNumber, n))}
            />
            <CompactStepper
              label="mp pihenő"
              value={restSec(sprint)}
              step={5}
              integer
              onChange={(n) => onStructure(setSprintRest(structure, weekNumber, n))}
            />
          </div>
        </div>
      )}

      {/* Péntek · Piramis */}
      {pyramid && (
        <div className="col gap-sm">
          <span className="label-mono" style={{ color: RUN }}>Péntek · Piramis</span>
          <PyramidPills
            values={workSecs(pyramid)}
            onChange={(arr) => onStructure(setPyramidWork(structure, weekNumber, arr))}
          />
          <span className="text-tertiary" style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            pihenő = szakasz × 2 · automatikus
          </span>
        </div>
      )}
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
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: 'var(--ff-mono)',
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 8px',
            borderRadius: 2,
            color: RUN,
            border: '1px solid color-mix(in srgb, var(--info) 35%, transparent)',
            background: 'color-mix(in srgb, var(--info) 8%, transparent)',
          }}
        >
          <button
            type="button"
            aria-label={`${v} mp szakasz váltása`}
            onClick={() => cycle(i)}
            style={{ color: 'inherit' }}
          >
            {v}
          </button>
          <button
            type="button"
            aria-label={`${v} mp szakasz törlése`}
            onClick={() => remove(i)}
            style={{ color: 'var(--text-tertiary)', fontSize: 11, lineHeight: 1 }}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={append}
        style={{
          fontFamily: 'var(--ff-mono)',
          fontSize: 11,
          fontWeight: 600,
          padding: '5px 8px',
          borderRadius: 2,
          color: RUN,
          border: '1px dashed color-mix(in srgb, var(--info) 45%, transparent)',
          background: 'transparent',
        }}
      >
        ＋ szakasz
      </button>
    </div>
  )
}
