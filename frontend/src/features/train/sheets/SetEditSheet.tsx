// ============================================================
// Mezo · SetEditSheet — edit or delete ONE set of the active workout (mezo-l3on).
// Opened by tapping a row of the active-workout set list. The destructive action removes the SLOT too
// (spec D2), floored at one slot per exercise (spec D4).
//
// Folyadék F4 (mezo-n4wf5.4, area C): a light sheet built to the prototype's `set` sheet
// (docs/design_2.0/prototypes/vilagos/edzes.js): the muscle chip beside the title, Súly / Ismétlés as stepper
// rows, RIR 0–5 as pills, the side on an isolation exercise (Bal / Mindkettő / Jobb — values stay L / B / R),
// the set's note, „Mentés" + „Mégse", and „Szett törlése" as the danger link. A slot that is not logged yet
// („pending") shows its targets dimmed and read-only, with delete only.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, FoSheetHead, Input, Lab, Lk, Note, Pill, Pills, SheetActs } from '@/shared/ui/folyadek'
import { Mchp, SidePicker } from '@/features/train/components/folyadek'
import { SetStepper } from '@/features/train/components/SetStepper'
import { RIR_VALUES } from '@/features/train/logic/rir'
import type { SetSide } from '@/features/train/logic/workoutState'

export interface SetEditValues {
  weight: number
  reps: number
  rir: number
  side: SetSide | null
  note: string
}

interface SetEditSheetProps {
  exerciseName: string
  /** „1. szett" — the row's own label. */
  setLabel: string
  /** 'pending' = the slot has no logged set yet: targets shown, read-only, delete only. */
  mode: 'logged' | 'pending'
  kind: 'warmup' | 'working'
  exerciseType: 'compound' | 'isolation' | 'plyo'
  initial: SetEditValues
  canDelete: boolean
  /** The exercise's muscle token — the chip in the head (visual only). */
  muscle?: string
  onSave: (v: SetEditValues) => void
  onDelete: () => void
  onClose: () => void
}

export function SetEditSheet({
  exerciseName, setLabel, mode, kind, exerciseType, initial, canDelete, muscle, onSave, onDelete, onClose,
}: SetEditSheetProps) {
  const [weight, setWeight] = useState(initial.weight)
  const [reps, setReps] = useState(initial.reps)
  const [rir, setRir] = useState(initial.rir)
  const [side, setSide] = useState<SetSide | null>(initial.side)
  const [note, setNote] = useState(initial.note)
  const readOnly = mode === 'pending'

  return (
    <Sheet onClose={onClose} labelledBy="set-edit-title" className="fo-sheet el-sheet">
      {(close) => (
        <>
          <FoSheetHead
            eyebrow={`${setLabel} · ${exerciseName}`} titleId="set-edit-title" onClose={close}
            title={readOnly ? 'Még nincs naplózva' : 'Szett szerkesztése'}
            sub={readOnly ? 'A cél áll itt — naplózni a gyakorlat soránál tudod.' : undefined}
            left={muscle ? <Mchp muscle={muscle} /> : undefined}
          />

          <div className={readOnly ? 'el-set is-ro' : 'el-set'}>
            <div className="el-ls">
              {exerciseType !== 'plyo' && (
                <SetStepper label="Súly" value={weight} step={2.5} unit="kg" min={0} max={999} disabled={readOnly} onChange={setWeight} />
              )}
              <SetStepper label="Ismétlés" value={reps} step={1} integer min={1} max={100} disabled={readOnly} onChange={setReps} />
            </div>

            {kind !== 'warmup' && (
              <>
                <Lab id="set-edit-rir">RIR</Lab>
                <Pills role="group" aria-labelledby="set-edit-rir">
                  {RIR_VALUES.map((n) => (
                    <Pill key={n} on={rir === n} disabled={readOnly} aria-label={`RIR ${n}`} onClick={() => setRir(n)}>{n}</Pill>
                  ))}
                </Pills>
              </>
            )}

            {exerciseType === 'isolation' && <SidePicker className="el-side" value={side} onChange={setSide} disabled={readOnly} />}
          </div>

          {!readOnly && (
            <>
              <Lab htmlFor="set-edit-note">Megjegyzés ehhez a szetthez (nem kötelező)</Lab>
              <Input
                id="set-edit-note" aria-label="Szett megjegyzés" placeholder="pl. az utolsó ismétlés kemény volt"
                maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
              />
              <SheetActs label="Mentés" onSave={() => { onSave({ weight, reps, rir, side, note }); close() }} onCancel={close} />
            </>
          )}

          <Acts>
            <Lk bad disabled={!canDelete} onClick={() => { onDelete(); close() }}>Szett törlése</Lk>
          </Acts>
          {!canDelete && (
            <Note>Az utolsó szett nem törölhető — ha ez a gyakorlat ma nem megy, hagyd ki a Műveletekben.</Note>
          )}
        </>
      )}
    </Sheet>
  )
}
