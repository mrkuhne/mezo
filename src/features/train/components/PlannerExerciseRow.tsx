// ============================================================
// Mezo · PlannerExerciseRow — one exercise row in the planner's program
// review (step 3). Visual drag handle, name + muscle + set/rep/RIR scheme,
// optional niggle warning, settings + remove (✕) affordances.
// Drag is VISUAL ONLY in Phase 1 (the handle renders, no DnD reorder).
// Ported from prototype meso-planner.jsx PlannerExerciseRow.
// ============================================================
import type { GymExercise } from '@/data/types'
import { Icon } from '@/components/ui/Icon'

export function PlannerExerciseRow({ ex, onRemove }: { ex: GymExercise; onRemove: () => void }) {
  return (
    <div className="card notch-4" style={{ padding: '10px 12px', background: 'var(--surface-2)' }}>
      <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
        <button
          type="button"
          aria-label="Átrendezés"
          style={{
            cursor: 'grab',
            padding: 4,
            color: 'var(--text-tertiary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            alignItems: 'center',
            marginTop: 2,
          }}
        >
          {[0, 1, 2].map((r) => (
            <span key={r} style={{ display: 'flex', gap: 2 }}>
              <span style={{ width: 2, height: 2, background: 'currentColor', borderRadius: '50%' }} />
              <span style={{ width: 2, height: 2, background: 'currentColor', borderRadius: '50%' }} />
            </span>
          ))}
        </button>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{ex.name}</span>
          <div className="row gap-sm mt-xs flex-wrap">
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
              {ex.muscle}
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
          <button type="button" className="chip" aria-label="Beállítások" style={{ padding: '5px 7px' }}>
            <Icon name="settings" size={10} />
          </button>
          <button type="button" onClick={onRemove} className="chip" aria-label="Eltávolítás" style={{ padding: '5px 7px' }}>
            <Icon name="x" size={10} />
          </button>
        </div>
      </div>
    </div>
  )
}
