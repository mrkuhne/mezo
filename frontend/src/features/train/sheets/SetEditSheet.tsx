// ============================================================
// Mezo · SetEditSheet — edit or delete ONE set of the active workout (mezo-l3on).
// Opened by tapping a row of the active-workout set list. Reuses the logging
// surface's own inputs (SetStepper + the RIR/Side pill rows) so the app has a
// single input language for a set; the destructive action removes the SLOT too
// (spec D2), floored at one slot per exercise (spec D4).
// Üvegesítés U4 (mezo-me75u.4): a floating coral glass sheet (bible rule 15) — the muscle in a
// lit well beside the title, flat steppers / RIR pills, a lit flat "Mentés" pill carrying the 3D
// tick (the old "Mentés ✓" glyph retired). Skin: `.wos-sheet` in the `uveg edzes session` block.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D } from '@/shared/ui/clay'
import { SetStepper } from '@/features/train/components/SetStepper'
import { MuscleChip } from '@/features/train/components/MuscleChip'
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
  /** "1. working szett" / "B1 bemelegítő szett" — the row's own label. */
  setLabel: string
  /** 'pending' = the slot has no logged set yet: targets shown, read-only, delete only. */
  mode: 'logged' | 'pending'
  kind: 'warmup' | 'working'
  exerciseType: 'compound' | 'isolation' | 'plyo'
  initial: SetEditValues
  canDelete: boolean
  /** The exercise's muscle token — drawn in the header's lit well (visual only). */
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
    <Sheet onClose={onClose} labelledBy="set-edit-title" className="glass wos-sheet">
      {(close) => (
        <>
          <div className="wos-sheet-head">
            {muscle && <span className="wos-sheet-art"><MuscleChip token={muscle} size={48} /></span>}
            <span className="wos-sheet-title">
              <span className="wos-sheet-eb">{setLabel}</span>
              <h3 id="set-edit-title">{exerciseName}</h3>
            </span>
          </div>

          <div className="steprow">
            {exerciseType !== 'plyo' && (
              <SetStepper label="Súly" value={weight} step={2.5} unit="kg" min={0} max={999}
                disabled={readOnly} onChange={setWeight} />
            )}
            <SetStepper label="Ismétlés" value={reps} step={1} integer min={1} max={100}
              disabled={readOnly} onChange={setReps} />
          </div>

          {kind !== 'warmup' && (
            <div className="rirrow">
              <span className="rk">RIR</span>
              {RIR_VALUES.map((n) => (
                <button key={n} type="button" disabled={readOnly} aria-pressed={rir === n}
                  aria-label={`RIR ${n}`} onClick={() => setRir(n)}>
                  {n}
                </button>
              ))}
            </div>
          )}

          {exerciseType === 'isolation' && (
            <div className="rirrow">
              <span className="rk">Side</span>
              {(['L', 'B', 'R'] as const).map((s) => (
                <button key={s} type="button" disabled={readOnly} aria-pressed={side === s}
                  onClick={() => setSide(side === s ? null : s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {!readOnly && (
            <input
              className="setnote"
              aria-label="Szett megjegyzés"
              placeholder="Megjegyzés ehhez a szetthez (opcionális)"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}

          {!readOnly && (
            <button type="button" className="wos-primary np-press"
              onClick={() => { onSave({ weight, reps, rir, side, note }); close() }}>
              <Icon3D name="t-tick" size={22} />
              Mentés
            </button>
          )}

          <button
            type="button"
            className="wos-pill is-block is-warn np-press"
            disabled={!canDelete}
            onClick={() => { onDelete(); close() }}
          >
            Szett törlése
          </button>
          {!canDelete && (
            <p className="wos-sheet-hint">
              Az utolsó szett nem törölhető — a gyakorlat kihagyásához használd a Kihagyás-t.
            </p>
          )}
        </>
      )}
    </Sheet>
  )
}
