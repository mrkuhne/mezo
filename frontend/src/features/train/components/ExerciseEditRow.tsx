// ============================================================
// Mezo · ExerciseEditRow — one editable exercise line inside a builder day.
// Drag handle (VISUAL ONLY — Phase 1 ships no real DnD), name, muscle label,
// sets × reps · RIR, optional warning, plus a settings chip that toggles an
// inline editor (EditorChip tiles + Csere / Variáns) and a ✕ chip that removes
// the exercise from the parent's local day-state.
// Ported from prototype mesocycles.jsx ExerciseEditRow.
// ============================================================
import { useState } from 'react'
import { MUSCLE_LABELS } from '@/data/train'
import type { GymExercise } from '@/data/types'
import { Icon } from '@/components/ui/Icon'
import { EditorChip } from './EditorChip'

interface ExerciseEditRowProps {
  ex: GymExercise
  onRemove: () => void
}

export function ExerciseEditRow({ ex, onRemove }: ExerciseEditRowProps) {
  const [showEditor, setShowEditor] = useState(false)

  return (
    <div className="card notch-4" style={{ padding: 0, background: 'var(--surface-2)' }}>
      <div style={{ padding: '10px 12px' }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          {/* Drag handle — visual only (no DnD wired in Phase 1) */}
          <span
            aria-hidden="true"
            style={{
              cursor: 'grab',
              padding: 4,
              color: 'var(--text-tertiary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 2,
            }}
          >
            {[0, 1, 2].map((row) => (
              <span key={row} style={{ display: 'flex', gap: 2 }}>
                <span style={{ width: 2, height: 2, background: 'currentColor', borderRadius: '50%' }} />
                <span style={{ width: 2, height: 2, background: 'currentColor', borderRadius: '50%' }} />
              </span>
            ))}
          </span>

          <div className="col flex-1" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{ex.name}</span>
            <div className="row gap-sm mt-xs flex-wrap">
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                {MUSCLE_LABELS[ex.muscle] ?? ex.muscle}
              </span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--brand-glow)' }}>
                {ex.sets} × {ex.targetReps} · RIR {ex.targetRIR}
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
              className="chip notch-4"
              style={{ padding: '5px 7px' }}
            >
              <Icon name="settings" size={10} />
            </button>
            <button
              onClick={onRemove}
              aria-label={`${ex.name} törlése`}
              className="chip notch-4"
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
          <div className="row gap-sm">
            <EditorChip label="Szet" val={ex.sets} />
            <EditorChip label="Rep target" val={ex.targetReps} />
            <EditorChip label="RIR" val={ex.targetRIR} />
          </div>
          <div className="row gap-sm mt-sm">
            <button className="chip notch-4" style={{ fontSize: 9 }}>
              <Icon name="tool" size={10} /> Csere
            </button>
            <button className="chip notch-4" style={{ fontSize: 9 }}>
              <Icon name="plus" size={10} /> Variáns
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
