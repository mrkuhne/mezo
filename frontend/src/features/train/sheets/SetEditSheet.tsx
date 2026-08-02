// ============================================================
// Mezo · SetEditSheet — edit or delete ONE set of the active workout (mezo-l3on).
// Opened by tapping a row of the active-workout set list. Reuses the logging
// surface's own inputs (SetStepper + the RIR/Side pill rows) so the app has a
// single input language for a set; the destructive action removes the SLOT too
// (spec D2), floored at one slot per exercise (spec D4).
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Display } from '@/shared/ui/Display'
import { SetStepper } from '@/features/train/components/SetStepper'
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
  onSave: (v: SetEditValues) => void
  onDelete: () => void
  onClose: () => void
}

export function SetEditSheet({
  exerciseName, setLabel, mode, kind, exerciseType, initial, canDelete, onSave, onDelete, onClose,
}: SetEditSheetProps) {
  const [weight, setWeight] = useState(initial.weight)
  const [reps, setReps] = useState(initial.reps)
  const [rir, setRir] = useState(initial.rir)
  const [side, setSide] = useState<SetSide | null>(initial.side)
  const [note, setNote] = useState(initial.note)
  const readOnly = mode === 'pending'

  return (
    <Sheet onClose={onClose} labelledBy="set-edit-title">
      {(close) => (
        <>
          <div className="col" style={{ marginBottom: 14 }}>
            <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>{setLabel}</span>
            <div id="set-edit-title" style={{ marginTop: 6 }}>
              <Display size="md">{exerciseName}</Display>
            </div>
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
              {[0, 1, 2, 3].map((n) => (
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
            <button type="button" className="donebtn np-press"
              onClick={() => { onSave({ weight, reps, rir, side, note }); close() }}>
              Mentés ✓
            </button>
          )}

          <button
            type="button"
            className="cta-ghost np-press"
            disabled={!canDelete}
            style={{
              marginTop: 9, width: '100%', padding: 12,
              color: 'var(--error)', boxShadow: 'inset 0 0 0 1.5px color-mix(in srgb, var(--error) 40%, transparent)',
              opacity: canDelete ? 1 : 0.45,
            }}
            onClick={() => { onDelete(); close() }}
          >
            Szett törlése
          </button>
          {!canDelete && (
            <p style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
              Az utolsó szett nem törölhető — a gyakorlat kihagyásához használd a Kihagyás-t.
            </p>
          )}
        </>
      )}
    </Sheet>
  )
}
