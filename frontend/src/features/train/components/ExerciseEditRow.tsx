// ============================================================
// Mezo · ExerciseEditRow — one editable exercise line inside a builder day.
// Name, muscle label, the prescribed-set recipe summary (warmup · working ·
// rep-range · RIR), optional warning, plus a settings chip that toggles an
// inline recipe editor (RecipeStepper tiles) and a ✕ chip that removes the
// exercise from the parent's local day-state. Each stepper fires onChange with
// a partial GymExercise patch which the parent applies + persists. The row is
// rendered as a SortableList item, which supplies the drag grip + ▲▼ controls.
// Ported from prototype mesocycles.jsx ExerciseEditRow.
// ============================================================
import { useState } from 'react'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'

interface ExerciseEditRowProps {
  ex: GymExercise
  onRemove: () => void
  onChange: (patch: Partial<GymExercise>) => void
}

export function ExerciseEditRow({ ex, onRemove, onChange }: ExerciseEditRowProps) {
  const [showEditor, setShowEditor] = useState(false)

  return (
    <div className="card" style={{ padding: 0, background: 'var(--surface-2)' }}>
      <div style={{ padding: '10px 12px' }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <div className="col flex-1" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{ex.name}</span>
            <div className="row gap-sm mt-xs flex-wrap">
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                {MUSCLE_LABELS[ex.muscle] ?? ex.muscle}
              </span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--brand-glow)' }}>
                {ex.warmupSets} bem · {ex.workingSets} work · {ex.repMin}-{ex.repMax} · RIR {ex.targetRIR}
                {ex.anchorWeightKg != null ? ` · ${ex.anchorWeightKg} kg` : ' · auto'}
              </span>
            </div>
            {ex.warning && (
              <div className="row gap-xs mt-xs" style={{ alignItems: 'center' }}>
                <Icon name="warning" size={10} color="var(--warning)" />
                <span style={{ fontSize: 10, color: 'var(--warning)', lineHeight: 1.4 }}>{ex.warning}</span>
              </div>
            )}
          </div>
          <div className="row gap-xs" style={{ flexShrink: 0 }}>
            <button
              onClick={() => setShowEditor((v) => !v)}
              aria-expanded={showEditor}
              aria-label={showEditor ? 'Szerkesztő bezárása' : 'Szerkesztő'}
              className="chip"
              style={{ padding: '5px 7px' }}
            >
              <Icon name="settings" size={10} />
            </button>
            <button
              onClick={onRemove}
              aria-label={`${ex.name} törlése`}
              className="chip"
              style={{ padding: '5px 7px' }}
            >
              <Icon name="x" size={10} />
            </button>
          </div>
        </div>
      </div>

      {showEditor && (
        <div
          style={{
            padding: '10px 12px 12px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface-1)',
          }}
        >
          <div className="row gap-sm flex-wrap">
            <RecipeStepper label="Bemelegítő" value={ex.warmupSets} min={0} max={10}
              onChange={(v) => onChange({ warmupSets: v })} />
            <RecipeStepper label="Working" value={ex.workingSets} min={1} max={10}
              onChange={(v) => onChange({ workingSets: v })} />
            <RecipeStepper label="Rep min" value={ex.repMin} min={1} max={ex.repMax}
              onChange={(v) => onChange({ repMin: v })} />
            <RecipeStepper label="Rep max" value={ex.repMax} min={ex.repMin} max={100}
              onChange={(v) => onChange({ repMax: v })} />
            <RecipeStepper label="RIR" value={ex.targetRIR} min={0} max={5}
              onChange={(v) => onChange({ targetRIR: v })} />
            <AnchorStepper value={ex.anchorWeightKg} onChange={(v) => onChange({ anchorWeightKg: v })} />
          </div>
        </div>
      )}
    </div>
  )
}

// A labelled −/value/+ tile wired to onChange.
// Clamps to [min, max] so the parent never receives an out-of-range recipe value.
function RecipeStepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div style={{ flex: '1 1 30%', minWidth: 88, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', padding: '6px 10px' }}>
      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{label}</span>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 600 }}>{value}</span>
        <div className="row gap-xs">
          <button type="button" aria-label={`${label} csökkentése`} onClick={() => onChange(clamp(value - 1))}
            style={{ width: 22, height: 22, background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--brand-glow)' }}>−</button>
          <button type="button" aria-label={`${label} növelése`} onClick={() => onChange(clamp(value + 1))}
            style={{ width: 22, height: 22, background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--brand-glow)' }}>+</button>
        </div>
      </div>
    </div>
  )
}

// The optional STARTING weight (anchor) — nullable, 2.5 kg steps, "auto" when unset.
// The recommendation engine uses it as the first-workout base (SetRecommendationService),
// so it seeds the pre-filled weight before any history exists. Decrementing below one
// step returns to "auto" (let the engine decide); "+" from auto starts at a sensible 20 kg.
function AnchorStepper({ value, onChange }: {
  value: number | null | undefined; onChange: (v: number | null) => void
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
    <div style={{ flex: '1 1 30%', minWidth: 88, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', padding: '6px 10px' }}>
      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>Kiinduló kg</span>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 600, color: isAuto ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
          {isAuto ? 'auto' : value}
        </span>
        <div className="row gap-xs">
          <button type="button" aria-label="Kiinduló súly csökkentése" onClick={dec}
            style={{ width: 22, height: 22, background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--brand-glow)' }}>−</button>
          <button type="button" aria-label="Kiinduló súly növelése" onClick={inc}
            style={{ width: 22, height: 22, background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--brand-glow)' }}>+</button>
        </div>
      </div>
    </div>
  )
}
