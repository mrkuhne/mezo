// ============================================================
// Mezo · CustomWorkoutSheet — "Saját edzés" entry sheet (mezo-ws2x):
// the saved custom templates (tap → start via /train/session?day=,
// ✎ → composer) + "Új összeállítása". Opened from Mai (rest-day card,
// weekly-plan footer, no-meso ghost) and GymPage's header chip.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useCustomWorkouts } from '@/data/hooks'

export function CustomWorkoutSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { customWorkouts } = useCustomWorkouts()
  return (
    <Sheet onClose={onClose} labelledBy="custom-workout-title">
      {(close) => (
        <>
          <div className="col" style={{ marginBottom: 12 }}>
            <span className="eyebrow brand">Saját edzés</span>
            <h2 id="custom-workout-title" style={{ fontSize: 18, marginTop: 4 }}>Mit nyomunk ma?</h2>
          </div>

          {customWorkouts.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              Még nincs mentett saját edzésed — rakd össze az elsőt.
            </p>
          )}

          <div className="col gap-sm" style={{ marginBottom: 12 }}>
            {customWorkouts.map((w) => (
              <div key={w.id} className="card row gap-sm" style={{ padding: '10px 12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => { navigate(`/train/session?day=${w.id}`); close() }}
                  className="col flex-1 np-press"
                  style={{ background: 'none', border: 'none', textAlign: 'left', minWidth: 0, cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{w.name}</span>
                  <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {w.exercises.length} gyakorlat · {w.exercises.reduce((a, e) => a + e.workingSets, 0)} szett
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${w.name} szerkesztése`}
                  onClick={() => { navigate(`/train/custom/${w.id}`); close() }}
                  className="chip"
                  style={{ padding: '5px 8px', flexShrink: 0 }}
                >
                  ✎
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { navigate('/train/custom/new'); close() }}
            className="card"
            style={{
              padding: 12, width: '100%', background: 'transparent', borderStyle: 'dashed',
              borderColor: 'var(--line)', color: 'var(--tag-gym)', fontSize: 10,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Icon name="plus" size={12} /> Új összeállítása
          </button>
        </>
      )}
    </Sheet>
  )
}
