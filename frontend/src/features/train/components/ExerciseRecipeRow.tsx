// ============================================================
// Mezo · ExerciseRecipeRow — one exercise of the saját edzés composer (mezo-ws2x).
// Üveg port (mezo-7ugb5): a flat summary row (muscle chip, name, „3 szett · 8–10 ism. ·
// RIR 1 · auto kg") that expands in place; the parent keeps one row open. The steppers come
// in pairs — Szettek · Ismétlés · Nehézség és súly — plus the volume switch and
// Feljebb / Lejjebb / Kivesz. Stepper aria labels stay name-scoped (`${ex.name} · <field>`).
// ============================================================
import type { ReactNode } from 'react'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise } from '@/data/types'
import { countsForVolume } from '@/features/train/logic/setBudget'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { Icon3D } from '@/shared/ui/clay'

const kg = (v: number) => String(v).replace('.', ',')

export function recipeSummary(ex: GymExercise): string {
  const anchor = ex.anchorWeightKg == null ? 'auto' : kg(ex.anchorWeightKg)
  return `${ex.workingSets} szett · ${ex.repMin}–${ex.repMax} ism. · RIR ${ex.targetRIR} · ${anchor} kg`
}

export function ExerciseRecipeRow({ ex, open, onToggle, onRemove, onChange, onMoveUp, onMoveDown }: {
  ex: GymExercise
  open: boolean
  onToggle: () => void
  onRemove: () => void
  onChange: (patch: Partial<GymExercise>) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const panelId = `cw-rec-${ex.id}`
  const volume = countsForVolume(ex)
  return (
    <div className={open ? 'uvx-cw-row is-open' : 'uvx-cw-row'}>
      <button type="button" className="uvx-cw-head" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <MuscleChip token={ex.muscle} size={28} />
        <span className="uvx-cw-nm">
          <strong>{ex.name}</strong>
          <small>{MUSCLE_LABELS[ex.muscle] ?? ex.muscle} · {recipeSummary(ex)}</small>
        </span>
        <b className="uvx-cw-chev" aria-hidden="true">›</b>
      </button>
      {ex.warning && (
        <p className="uvx-cw-warn"><Icon3D name="t-bandage" size={18} />{ex.warning}</p>
      )}
      {open && (
        <div className="uvx-cw-panel" id={panelId}>
          <Group label="Szettek">
            <Stepper label="Bemelegítő" aria={`${ex.name} · Bemelegítő`} value={ex.warmupSets} min={0} max={10}
              onChange={(v) => onChange({ warmupSets: v })} />
            <Stepper label="Munka" aria={`${ex.name} · Working`} value={ex.workingSets} min={1} max={10}
              onChange={(v) => onChange({ workingSets: v })} />
          </Group>
          <Group label="Ismétlés">
            <Stepper label="Tól" aria={`${ex.name} · Rep min`} value={ex.repMin} min={1} max={ex.repMax}
              onChange={(v) => onChange({ repMin: v })} />
            <Stepper label="Ig" aria={`${ex.name} · Rep max`} value={ex.repMax} min={ex.repMin} max={100}
              onChange={(v) => onChange({ repMax: v })} />
          </Group>
          <Group label="Nehézség és súly">
            <Stepper label="Tartalék (RIR)" aria={`${ex.name} · RIR`} value={ex.targetRIR} min={0} max={5}
              onChange={(v) => onChange({ targetRIR: v })} />
            <AnchorStepper aria={`${ex.name} · Kiinduló súly`} value={ex.anchorWeightKg}
              onChange={(v) => onChange({ anchorWeightKg: v })} />
          </Group>
          <button type="button" role="switch" aria-checked={volume} aria-label={`${ex.name} · számít a volumenbe`}
            className={volume ? 'uvx-cw-vol is-on' : 'uvx-cw-vol'}
            onClick={() => onChange({ countsTowardVolume: !volume })}>
            <span className="uvx-cw-sw" aria-hidden="true" />Számít a heti volumenbe
          </button>
          <div className="uvx-cw-foot">
            <button type="button" className="uvx-cw-act" disabled={!onMoveUp} onClick={onMoveUp}>
              <Icon3D name="t-up" size={20} />Feljebb</button>
            <button type="button" className="uvx-cw-act" disabled={!onMoveDown} onClick={onMoveDown}>
              <Icon3D name="t-down" size={20} />Lejjebb</button>
            <button type="button" className="uvx-cw-act is-warn" aria-label={`${ex.name} törlése`} onClick={onRemove}>
              <Icon3D name="t-trash" size={20} />Kivesz</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="uvx-cw-grp">
      <span className="uv-eyebrow">{label}</span>
      <div className="uvx-cw-pair">{children}</div>
    </div>
  )
}

// −/value/+ tile; clamps to [min, max] so the parent never receives an out-of-range value.
function Stepper({ label, aria, value, min, max, onChange }: {
  label: string; aria: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="uvx-cw-st">
      <button type="button" aria-label={`${aria} csökkentése`} onClick={() => onChange(clamp(value - 1))}>−</button>
      <span><b data-testid={`${aria} érték`}>{value}</b><small>{label}</small></span>
      <button type="button" aria-label={`${aria} növelése`} onClick={() => onChange(clamp(value + 1))}>+</button>
    </div>
  )
}

// The optional STARTING weight (anchor) — nullable, 2.5 kg steps, "auto" when unset. The
// recommendation engine uses it as the first-workout base (SetRecommendationService).
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
    <div className="uvx-cw-st">
      <button type="button" aria-label={`${aria} csökkentése`} onClick={dec}>−</button>
      <span><b className={isAuto ? 'is-auto' : undefined} data-testid={`${aria} érték`}>{isAuto ? 'auto' : kg(value)}</b><small>Kiinduló kg</small></span>
      <button type="button" aria-label={`${aria} növelése`} onClick={inc}>+</button>
    </div>
  )
}
