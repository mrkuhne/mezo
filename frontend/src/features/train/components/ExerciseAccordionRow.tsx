// ============================================================
// Mezo · ExerciseAccordionRow — one exercise of the running plan's day editor
// (mezo-7rdg; Folyadék mezo-n4wf5.3, prototype vilagos/edzes.js `edRow()`).
// Collapsed: the muscle chip, the name, „izom · 4×6–8 · Failure｜Volume" and the sets as
// capsules (grey = warm-up, the muscle's colour = working). Open: the Failure / Volume
// pills, one − value + line per knob (Munkaszett, Rep tartomány, Kiinduló kg, Bemelegítő
// with its „↺ javaslat"), the volume switch, the Finomhangolás disclosure (RIR, Rep min,
// Rep max) and Törlés. Behaviour is the pre-Folyadék one, knob for knob; a − / + that
// would do nothing at its bound is drawn disabled.
// The row head is shared with ExerciseRecipeRow; the stepper line, the switch and the panel are the Edzés-shared
// pieces of components/folyadek/lines.tsx.
// ============================================================
import { useState } from 'react'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise } from '@/data/types'
import { countsForVolume, setStyle } from '@/features/train/logic/setBudget'
import { KnobLine, KnobPanel, Mchp, StepLine, AnchorLine, VolumeSwitch, deepMuscle } from '@/features/train/components/folyadek'
import { Acts, Caps, Lk, Pill, Pills, Row } from '@/shared/ui/folyadek'

/** The collapsed face of an editor row: chip, name, a summary line, the sets as capsules, the warning. */
export function ExRowHead({ ex, summary, open, onToggle, ariaLabel, controls }: {
  ex: GymExercise; summary: string; open: boolean; onToggle: () => void; ariaLabel?: string; controls?: string
}) {
  return (
    <Row
      className={open ? 'ee-exh open' : 'ee-exh'}
      left={<Mchp muscle={ex.muscle} sm />}
      title={ex.name}
      sub={`${MUSCLE_LABELS[ex.muscle] ?? ex.muscle} · ${summary}`}
      more={(
        <>
          <span className="fo-rowbar">
            <Caps n={ex.warmupSets} color="var(--fo-faint)" size="xs" />
            <Caps n={ex.workingSets} done={ex.workingSets} color={deepMuscle(ex.muscle)} />
          </span>
          {ex.warning && <span className="ee-warn">{ex.warning}</span>}
        </>
      )}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={ariaLabel}
      aria-controls={controls}
    />
  )
}

export function ExerciseAccordionRow({ ex, expanded, onToggle, onRemove, onChange, highlight, suggestedWarmup }: {
  ex: GymExercise
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
  onChange: (patch: Partial<GymExercise>) => void
  /** Set when this exercise's budget group is over the SESSION_MUSCLE_CAP on the active day. */
  highlight?: boolean
  /** `suggestedWarmupSets(day, ex.id)` (`logic/warmupSuggest.ts`) — shows the "↺ javaslat" link
   * when it differs from the stored `ex.warmupSets`; omitted → no link. */
  suggestedWarmup?: number
}) {
  const [fineTuneOpen, setFineTuneOpen] = useState(false)
  const isFailure = setStyle(ex.targetRIR) === 'failure'
  const n = ex.name

  return (
    <div className="ee-ex" data-over={highlight ? 'true' : undefined}>
      {/* "· szerkesztés" tells this toggle apart from SortableList's name-prefixed
          reorder buttons ("<name> áthelyezése / feljebb / lejjebb"). */}
      <ExRowHead ex={ex} open={expanded} onToggle={onToggle} ariaLabel={`${n} · szerkesztés`}
        summary={`${ex.workingSets}×${ex.repMin}–${ex.repMax} · ${isFailure ? 'Failure' : 'Volume'}`} />

      {expanded && (
        <KnobPanel className="ee-sjp">
          <Pills>
            <Pill on={isFailure} onClick={() => onChange({ targetRIR: 0 })}>Failure</Pill>
            <Pill on={!isFailure} onClick={() => onChange({ targetRIR: 2 })}>Volume</Pill>
          </Pills>
          <StepLine label="Munkaszett" name={`${n} · Munkaszett`} value={ex.workingSets}
            onDec={() => onChange({ workingSets: Math.max(1, ex.workingSets - 1) })}
            onInc={() => onChange({ workingSets: Math.min(10, ex.workingSets + 1) })}
            lo={ex.workingSets <= 1} hi={ex.workingSets >= 10} />
          {/* The line only SHIFTS the window — its width belongs to Finomhangolás. */}
          <StepLine label="Rep tartomány" name={`${n} · Rep tartomány`} value={`${ex.repMin}–${ex.repMax}`}
            onDec={() => { if (ex.repMin > 1) onChange({ repMin: ex.repMin - 1, repMax: ex.repMax - 1 }) }}
            onInc={() => { if (ex.repMax < 100) onChange({ repMin: ex.repMin + 1, repMax: ex.repMax + 1 }) }}
            lo={ex.repMin <= 1} hi={ex.repMax >= 100} />
          <AnchorLine name={`${n} · Kiinduló kg`} value={ex.anchorWeightKg} onChange={(v) => onChange({ anchorWeightKg: v })} />
          <StepLine label="Bemelegítő" name={`${n} · Bemelegítő`} value={ex.warmupSets}
            onDec={() => onChange({ warmupSets: Math.max(0, ex.warmupSets - 1) })}
            onInc={() => onChange({ warmupSets: Math.min(10, ex.warmupSets + 1) })}
            lo={ex.warmupSets <= 0} hi={ex.warmupSets >= 10} />
          {suggestedWarmup !== undefined && suggestedWarmup !== ex.warmupSets && (
            <KnobLine label="">
              <Lk onClick={() => onChange({ warmupSets: suggestedWarmup })} aria-label={`${n} · bemelegítés javaslat alkalmazása`}>
                ↺ javaslat: {suggestedWarmup}
              </Lk>
            </KnobLine>
          )}
          <VolumeSwitch name={n} label="Számít a volumenbe" on={countsForVolume(ex)} onChange={(v) => onChange({ countsTowardVolume: v })} />
          <KnobLine>
            <Lk aria-expanded={fineTuneOpen} onClick={() => setFineTuneOpen((v) => !v)}>Finomhangolás {fineTuneOpen ? '▴' : '▾'}</Lk>
          </KnobLine>
          {fineTuneOpen && (
            <>
              <StepLine label="RIR" name={`${n} · RIR`} value={ex.targetRIR}
                onDec={() => onChange({ targetRIR: Math.max(0, ex.targetRIR - 1) })}
                onInc={() => onChange({ targetRIR: Math.min(5, ex.targetRIR + 1) })}
                lo={ex.targetRIR <= 0} hi={ex.targetRIR >= 5} />
              <StepLine label="Rep min" name={`${n} · Rep min`} value={ex.repMin}
                onDec={() => onChange({ repMin: Math.max(1, ex.repMin - 1) })}
                onInc={() => onChange({ repMin: Math.min(ex.repMax, ex.repMin + 1) })}
                lo={ex.repMin <= 1} hi={ex.repMin >= ex.repMax} />
              <StepLine label="Rep max" name={`${n} · Rep max`} value={ex.repMax}
                onDec={() => onChange({ repMax: Math.max(ex.repMin, ex.repMax - 1) })}
                onInc={() => onChange({ repMax: Math.min(100, ex.repMax + 1) })}
                lo={ex.repMax <= ex.repMin} hi={ex.repMax >= 100} />
            </>
          )}
          <Acts>
            <Lk bad onClick={onRemove} aria-label={`${n} törlése`}>Törlés</Lk>
          </Acts>
        </KnobPanel>
      )}
    </div>
  )
}
