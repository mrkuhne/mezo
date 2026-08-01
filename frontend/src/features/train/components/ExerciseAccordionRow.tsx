// ============================================================
// Mezo · ExerciseAccordionRow — accordion-style exercise recipe row for the
// unified set-budget editor (mezo-7rdg, spec 2026-08-01-set-budget-unified-
// editor). Collapsed: name + muscle pill + style summary chip (🔥 failure /
// 🌿 volume, derived from setStyle(targetRIR)). Expanded: adds a Failure/
// Volume segmented toggle + a 2×2 stepper grid (working sets, rep window,
// starting weight, warmup sets) + a "Finomhangolás" disclosure for the raw
// RIR/rep-min/rep-max knobs. Replaces the always-open ExerciseRecipeRow in
// the unified editor (ExerciseRecipeRow itself stays, for CustomWorkoutBuilderPage).
// ============================================================
import { useState } from 'react'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise } from '@/data/types'
import { setStyle } from '@/features/train/logic/setBudget'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { Icon } from '@/shared/ui/Icon'

export function ExerciseAccordionRow({ ex, expanded, onToggle, onRemove, onChange }: {
  ex: GymExercise
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
  onChange: (patch: Partial<GymExercise>) => void
}) {
  const [fineTuneOpen, setFineTuneOpen] = useState(false)
  const fam = muscleColor(ex.muscle)
  const style = setStyle(ex.targetRIR)
  const isFailure = style === 'failure'

  return (
    <div className="card" style={{ borderLeft: `5px solid ${fam.rail}`, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={ex.name}
        className="row"
        style={{
          width: '100%', alignItems: 'center', gap: 10, padding: '10px 12px',
          background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer',
        }}
      >
        <div className="col flex-1" style={{ minWidth: 0, gap: 4 }}>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>
            {ex.name}
          </span>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="label-mono" style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
              background: fam.wash, color: fam.deep, textTransform: 'uppercase',
            }}>
              {MUSCLE_LABELS[ex.muscle] ?? ex.muscle}
            </span>
            <StyleChip isFailure={isFailure} workingSets={ex.workingSets} repMin={ex.repMin} repMax={ex.repMax} />
          </div>
          {ex.warning && (
            <div className="row gap-xs" style={{ alignItems: 'center' }}>
              <Icon name="warning" size={10} color="var(--warning)" />
              <span style={{ fontSize: 10, color: 'var(--warning)', lineHeight: 1.4 }}>{ex.warning}</span>
            </div>
          )}
        </div>
        <span style={{ fontSize: 14, color: 'var(--text-tertiary)', flexShrink: 0 }}>{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div className="col" style={{ gap: 12, padding: '0 12px 12px' }}>
          <div className="row" style={{
            gap: 2, padding: 3, borderRadius: 10, background: 'var(--surface-2)',
          }}>
            <button
              type="button"
              aria-pressed={isFailure}
              onClick={() => onChange({ targetRIR: 0 })}
              className="row flex-1"
              style={{
                justifyContent: 'center', alignItems: 'center', gap: 4, padding: '7px 0', borderRadius: 8,
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: isFailure ? 'linear-gradient(135deg, var(--coral), var(--coral-deep))' : 'transparent',
                color: isFailure ? 'var(--text-inverse)' : 'var(--text-secondary)',
              }}
            >
              🔥 Failure
            </button>
            <button
              type="button"
              aria-pressed={!isFailure}
              onClick={() => onChange({ targetRIR: 2 })}
              className="row flex-1"
              style={{
                justifyContent: 'center', alignItems: 'center', gap: 4, padding: '7px 0', borderRadius: 8,
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: !isFailure ? 'var(--sage-deep)' : 'transparent',
                color: !isFailure ? 'var(--text-inverse)' : 'var(--text-secondary)',
              }}
            >
              🌿 Volume
            </button>
          </div>

          <div className="row gap-xs flex-wrap">
            <StepperTile
              label="Munkaszett" aria={`${ex.name} · Munkaszett`}
              value={ex.workingSets}
              onDec={() => onChange({ workingSets: Math.max(1, ex.workingSets - 1) })}
              onInc={() => onChange({ workingSets: Math.min(10, ex.workingSets + 1) })}
            />
            <StepperTile
              label="Rep tartomány" aria={`${ex.name} · Rep tartomány`}
              value={`${ex.repMin}–${ex.repMax}`}
              onDec={() => onChange({ repMin: Math.max(1, ex.repMin - 1), repMax: Math.max(1, ex.repMax - 1) })}
              onInc={() => onChange({ repMin: Math.min(100, ex.repMin + 1), repMax: Math.min(100, ex.repMax + 1) })}
            />
            <AnchorTile aria={`${ex.name} · Kiinduló kg`} value={ex.anchorWeightKg} onChange={(v) => onChange({ anchorWeightKg: v })} />
            <StepperTile
              label="Bemelegítő" aria={`${ex.name} · Bemelegítő`}
              value={ex.warmupSets}
              onDec={() => onChange({ warmupSets: Math.max(0, ex.warmupSets - 1) })}
              onInc={() => onChange({ warmupSets: Math.min(10, ex.warmupSets + 1) })}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setFineTuneOpen((v) => !v)}
              className="label-mono"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 9, color: 'var(--text-tertiary)',
              }}
            >
              Finomhangolás {fineTuneOpen ? '▴' : '▾'}
            </button>
            {fineTuneOpen && (
              <div className="row gap-xs flex-wrap" style={{ marginTop: 8 }}>
                <SmallStepperTile
                  label="RIR" aria={`${ex.name} · RIR`}
                  value={ex.targetRIR}
                  onDec={() => onChange({ targetRIR: Math.max(0, ex.targetRIR - 1) })}
                  onInc={() => onChange({ targetRIR: Math.min(5, ex.targetRIR + 1) })}
                />
                <SmallStepperTile
                  label="Rep min" aria={`${ex.name} · Rep min`}
                  value={ex.repMin}
                  onDec={() => onChange({ repMin: Math.max(1, ex.repMin - 1) })}
                  onInc={() => onChange({ repMin: Math.min(ex.repMax, ex.repMin + 1) })}
                />
                <SmallStepperTile
                  label="Rep max" aria={`${ex.name} · Rep max`}
                  value={ex.repMax}
                  onDec={() => onChange({ repMax: Math.max(ex.repMin, ex.repMax - 1) })}
                  onInc={() => onChange({ repMax: Math.min(100, ex.repMax + 1) })}
                />
              </div>
            )}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${ex.name} törlése`}
              className="chip"
              style={{ padding: '5px 7px' }}
            >
              <Icon name="x" size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Collapsed-header summary chip — 🔥 failure or 🌿 volume + set×rep shorthand.
function StyleChip({ isFailure, workingSets, repMin, repMax }: {
  isFailure: boolean; workingSets: number; repMin: number; repMax: number
}) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
      background: isFailure ? 'color-mix(in srgb, var(--coral) 10%, transparent)' : 'var(--wash-sage)',
      color: isFailure ? 'var(--coral-deep)' : 'var(--sage-deep)',
    }}>
      {isFailure ? '🔥' : '🌿'} {workingSets}×{repMin}–{repMax}
    </span>
  )
}

// A 2×2 grid stepper tile: label caption + value + 28px −/+ buttons (bigger than
// ExerciseRecipeRow's 18px, per the composite-v2 mockup).
function StepperTile({ label, aria, value, onDec, onInc }: {
  label: string; aria: string; value: number | string; onDec: () => void; onInc: () => void
}) {
  return (
    <div style={{ flex: '1 1 45%', minWidth: 100, background: 'var(--surface-2)', borderRadius: 12, padding: '6px 10px' }}>
      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{label}</span>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 700 }}>{value}</span>
        <div className="row gap-xs">
          <button type="button" aria-label={`${aria} csökkentése`} onClick={onDec}
            style={{ width: 28, height: 28, borderRadius: 10, background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--coral)' }}>−</button>
          <button type="button" aria-label={`${aria} növelése`} onClick={onInc}
            style={{ width: 28, height: 28, borderRadius: 10, background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--coral)' }}>+</button>
        </div>
      </div>
    </div>
  )
}

// The optional STARTING weight (anchor) — nullable, 2.5 kg steps, "auto" when unset.
// Ported verbatim (semantics) from ExerciseRecipeRow.tsx's AnchorStepper, sized to
// match the other 2×2 grid tiles here.
function AnchorTile({ aria, value, onChange }: {
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
    <div style={{ flex: '1 1 45%', minWidth: 100, background: 'var(--surface-2)', borderRadius: 12, padding: '6px 10px' }}>
      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>Kiinduló kg</span>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 700, color: isAuto ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
          {isAuto ? 'auto' : value}
        </span>
        <div className="row gap-xs">
          <button type="button" aria-label={`${aria} csökkentése`} onClick={dec}
            style={{ width: 28, height: 28, borderRadius: 10, background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--coral)' }}>−</button>
          <button type="button" aria-label={`${aria} növelése`} onClick={inc}
            style={{ width: 28, height: 28, borderRadius: 10, background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--coral)' }}>+</button>
        </div>
      </div>
    </div>
  )
}

// Compact stepper for the Finomhangolás disclosure row (RIR / rep min / rep max) —
// smaller than the 2×2 grid tiles, closer to ExerciseRecipeRow's original RecipeStepper.
function SmallStepperTile({ label, aria, value, onDec, onInc }: {
  label: string; aria: string; value: number; onDec: () => void; onInc: () => void
}) {
  return (
    <div style={{ flex: '1 1 30%', minWidth: 68, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', padding: '4px 8px' }}>
      <span className="label-mono" style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>{label}</span>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 13, fontWeight: 600 }}>{value}</span>
        <div className="row gap-xs">
          <button type="button" aria-label={`${aria} csökkentése`} onClick={onDec}
            style={{ width: 18, height: 18, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--coral)' }}>−</button>
          <button type="button" aria-label={`${aria} növelése`} onClick={onInc}
            style={{ width: 18, height: 18, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--coral)' }}>+</button>
        </div>
      </div>
    </div>
  )
}
