// ============================================================
// Mezo · CustomWorkoutSheet — "Saját edzés" entry sheet (mezo-ws2x):
// the saved custom templates (tap → start via /train/session?day=,
// pencil → composer) + "Új összeállítása". Opened from Mai (rest-day card,
// weekly-plan footer, no-meso ghost) and GymPage's header chip.
// Üveg (U10, mezo-me75u.10): a coral glass sheet, the dumbbell 3D head, the saved workouts as
// flat rows (the edit door a flat round pencil), and „Új összeállítása" as the dashed free slot.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import { useCustomWorkouts } from '@/data/hooks'

export function CustomWorkoutSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { customWorkouts } = useCustomWorkouts()
  return (
    <Sheet glass onClose={onClose} labelledBy="custom-workout-title" className="uvl-edzes">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-dumbbell" eyebrow="Saját edzés" title="Mit nyomunk ma?" titleId="custom-workout-title" onClose={close} />

          {customWorkouts.length === 0 && (
            <p className="uvl-lead">Még nincs mentett saját edzésed — rakd össze az elsőt.</p>
          )}

          <div className="uvl-rows">
            {customWorkouts.map((w) => (
              <div key={w.id} className="uvl-cell uvl-cw">
                <button
                  type="button"
                  onClick={() => { navigate(`/train/session?day=${w.id}`); close() }}
                  className="uvl-cw-go"
                >
                  <strong>{w.name}</strong>
                  <small>
                    {w.exercises.length} gyakorlat · {w.exercises.reduce((a, e) => a + e.workingSets, 0)} szett
                  </small>
                </button>
                <button
                  type="button"
                  aria-label={`${w.name} szerkesztése`}
                  onClick={() => { navigate(`/train/custom/${w.id}`); close() }}
                  className="uvl-x uvl-cw-edit"
                >
                  <Icon3D name="t-pencil" size={20} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { navigate('/train/custom/new'); close() }}
            className="uvl-new uv-empty"
          >
            <span aria-hidden="true">+</span> Új összeállítása
          </button>
        </div>
      )}
    </Sheet>
  )
}
