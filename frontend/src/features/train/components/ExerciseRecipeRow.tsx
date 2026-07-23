// ============================================================
// Mezo · ExerciseRecipeRow — one exercise's recipe editor row (name +
// muscle + remove ✕ + the six always-visible recipe steppers). Shared by
// MesoDayTabsEditor (planner/builder) and CustomWorkoutBuilderPage (saját
// edzés composer, mezo-ws2x). Extracted verbatim from MesoDayTabsEditor.
// ============================================================
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'

// One exercise line: header (name + muscle) + remove ✕, with the six recipe
// steppers ALWAYS visible below (no expand/collapse, no summary line). Stepper
// aria-labels are name-scoped (`${ex.name} · <field> növelése`) so they stay
// unique across the always-open rows.
export function ExerciseRecipeRow({ ex, onRemove, onChange }: {
  ex: GymExercise
  onRemove: () => void
  onChange: (patch: Partial<GymExercise>) => void
}) {
  return (
    <div className="card" style={{ padding: '10px 12px', background: 'var(--surface-2)' }}>
      <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{ex.name}</span>
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {MUSCLE_LABELS[ex.muscle] ?? ex.muscle}
          </span>
          {ex.warning && (
            <div className="row gap-xs mt-xs" style={{ alignItems: 'center' }}>
              <Icon name="warning" size={10} color="var(--warning)" />
              <span style={{ fontSize: 10, color: 'var(--warning)', lineHeight: 1.4 }}>{ex.warning}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${ex.name} törlése`}
          className="chip"
          style={{ padding: '5px 7px', flexShrink: 0 }}
        >
          <Icon name="x" size={10} />
        </button>
      </div>

      <div className="row gap-xs flex-wrap" style={{ marginTop: 8 }}>
        <RecipeStepper label="Bem" aria={`${ex.name} · Bemelegítő`} value={ex.warmupSets} min={0} max={10}
          onChange={(v) => onChange({ warmupSets: v })} />
        <RecipeStepper label="Work" aria={`${ex.name} · Working`} value={ex.workingSets} min={1} max={10}
          onChange={(v) => onChange({ workingSets: v })} />
        <RecipeStepper label="Rep min" aria={`${ex.name} · Rep min`} value={ex.repMin} min={1} max={ex.repMax}
          onChange={(v) => onChange({ repMin: v })} />
        <RecipeStepper label="Rep max" aria={`${ex.name} · Rep max`} value={ex.repMax} min={ex.repMin} max={100}
          onChange={(v) => onChange({ repMax: v })} />
        <RecipeStepper label="RIR" aria={`${ex.name} · RIR`} value={ex.targetRIR} min={0} max={5}
          onChange={(v) => onChange({ targetRIR: v })} />
        <AnchorStepper aria={`${ex.name} · Kiinduló súly`} value={ex.anchorWeightKg}
          onChange={(v) => onChange({ anchorWeightKg: v })} />
      </div>
    </div>
  )
}

// A compact labelled −/value/+ tile wired to onChange. `label` is the short
// display caption; `aria` is the name-scoped base (`${ex.name} · <field>`) so the
// −/+ buttons get unique labels across the always-open rows.
// Clamps to [min, max] so the parent never receives an out-of-range recipe value.
function RecipeStepper({ label, aria, value, min, max, onChange }: {
  label: string; aria: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div style={{ flex: '1 1 30%', minWidth: 68, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', padding: '4px 8px' }}>
      <span className="label-mono" style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>{label}</span>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 13, fontWeight: 600 }}>{value}</span>
        <div className="row gap-xs">
          <button type="button" aria-label={`${aria} csökkentése`} onClick={() => onChange(clamp(value - 1))}
            style={{ width: 18, height: 18, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--coral)' }}>−</button>
          <button type="button" aria-label={`${aria} növelése`} onClick={() => onChange(clamp(value + 1))}
            style={{ width: 18, height: 18, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--coral)' }}>+</button>
        </div>
      </div>
    </div>
  )
}

// The optional STARTING weight (anchor) — nullable, 2.5 kg steps, "auto" when unset.
// The recommendation engine uses it as the first-workout base (SetRecommendationService),
// so it seeds the pre-filled weight before any history exists. Decrementing below one
// step returns to "auto" (let the engine decide); "+" from auto starts at a sensible 20 kg.
function AnchorStepper({ aria, value, onChange }: {
  aria: string; value: number | null | undefined; onChange: (v: number | null) => void
}) {
  const STEP = 2.5
  const START = 20
  const round = (n: number) => Math.round(n * 100) / 100
  const isAuto = value == null
  const dec = () => {
    if (isAuto) return
    const next = round(value - STEP)
    onChange(next < STEP ? null : next)
  }
  const inc = () => onChange(isAuto ? START : Math.min(999, round(value + STEP)))
  return (
    <div style={{ flex: '1 1 30%', minWidth: 68, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', padding: '4px 8px' }}>
      <span className="label-mono" style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>Kiinduló kg</span>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 13, fontWeight: 600, color: isAuto ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
          {isAuto ? 'auto' : value}
        </span>
        <div className="row gap-xs">
          <button type="button" aria-label={`${aria} csökkentése`} onClick={dec}
            style={{ width: 18, height: 18, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--coral)' }}>−</button>
          <button type="button" aria-label={`${aria} növelése`} onClick={inc}
            style={{ width: 18, height: 18, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--coral)' }}>+</button>
        </div>
      </div>
    </div>
  )
}
