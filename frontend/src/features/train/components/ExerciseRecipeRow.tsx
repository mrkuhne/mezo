// ============================================================
// Mezo · ExerciseRecipeRow — one exercise of the saját edzés composer (mezo-ws2x;
// Folyadék mezo-n4wf5.3, prototype vilagos/edzes.js `sjRow()`).
// A summary row (muscle chip, name, „izom · 3 szett · 8–10 ism. · RIR 1 · auto kg", the sets
// as capsules) that opens in place; the parent keeps one row open. The knobs come in three
// labelled groups — Szettek · Ismétlés · Nehézség és súly — then the volume switch and
// Feljebb / Lejjebb / Kivesz. Stepper names stay name-scoped (`${ex.name} · <field>`).
// ============================================================
import type { GymExercise } from '@/data/types'
import { countsForVolume } from '@/features/train/logic/setBudget'
import { AnchorLine, ExRowHead, StepLine, VolumeSwitch, kgText } from '@/features/train/components/ExerciseAccordionRow'
import { Acts, Lab, Lk } from '@/shared/ui/folyadek'

export function recipeSummary(ex: GymExercise): string {
  const anchor = ex.anchorWeightKg == null ? 'auto' : kgText(ex.anchorWeightKg)
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
  const n = ex.name
  // − / + clamp to [min, max]; at the bound the button is disabled, so the parent never gets an out-of-range value.
  const step = (label: string, field: string, key: 'warmupSets' | 'workingSets' | 'repMin' | 'repMax' | 'targetRIR', min: number, max: number) => (
    <StepLine label={label} name={`${n} · ${field}`} value={ex[key]}
      onDec={() => onChange({ [key]: Math.max(min, ex[key] - 1) })}
      onInc={() => onChange({ [key]: Math.min(max, ex[key] + 1) })}
      lo={ex[key] <= min} hi={ex[key] >= max} />
  )
  return (
    <div className="ee-ex">
      <ExRowHead ex={ex} open={open} onToggle={onToggle} controls={panelId} summary={recipeSummary(ex)} />
      {open && (
        <div className="ee-sjp" id={panelId}>
          <Lab>Szettek</Lab>
          {step('Bemelegítő', 'Bemelegítő', 'warmupSets', 0, 10)}
          {step('Munka', 'Working', 'workingSets', 1, 10)}
          <Lab>Ismétlés</Lab>
          {step('Tól', 'Rep min', 'repMin', 1, ex.repMax)}
          {step('Ig', 'Rep max', 'repMax', ex.repMin, 100)}
          <Lab>Nehézség és súly</Lab>
          {step('Tartalék (RIR)', 'RIR', 'targetRIR', 0, 5)}
          <AnchorLine name={`${n} · Kiinduló súly`} value={ex.anchorWeightKg} onChange={(v) => onChange({ anchorWeightKg: v })} />
          <VolumeSwitch name={n} label="Számít a heti volumenbe" on={countsForVolume(ex)} onChange={(v) => onChange({ countsTowardVolume: v })} />
          <Acts>
            <Lk disabled={!onMoveUp} onClick={onMoveUp}>Feljebb</Lk>
            <Lk disabled={!onMoveDown} onClick={onMoveDown}>Lejjebb</Lk>
            <Lk className="ee-bad" aria-label={`${n} törlése`} onClick={onRemove}>Kivesz</Lk>
          </Acts>
        </div>
      )}
    </div>
  )
}
