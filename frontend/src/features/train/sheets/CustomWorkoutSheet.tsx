// ============================================================
// Mezo · CustomWorkoutSheet — "Saját edzés" entry sheet (mezo-ws2x):
// the saved custom templates (tap → start via /train/session?day=,
// „szerkesztés" → composer) + "Új összeállítása". Opened from Mai (the no-plan hero,
// the „Egyedi edzés" tile, the rest-day hero, the today-only link) and Terhelés.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `SHEETS.custom`): a light sheet — the dumbbell
// head, each saved workout a row with its sets as empty capsules in the exercise's muscle colour
// (one group per exercise), the „szerkesztés" link beside it, and the small „+ Új összeállítása" button.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, Caps, Chev, FoSheetHead, Lk, Row, Txt } from '@/shared/ui/folyadek'
import { useCustomWorkouts } from '@/data/hooks'
import { deepMuscle } from '@/features/train/components/folyadek'

export function CustomWorkoutSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { customWorkouts } = useCustomWorkouts()
  return (
    <Sheet onClose={onClose} labelledBy="custom-workout-title" className="fo-sheet em-custom">
      {(close) => (
        <>
          <FoSheetHead icon="t-dumbbell" eyebrow="Saját edzés" title="Mit nyomunk ma?" titleId="custom-workout-title" onClose={close} />

          {customWorkouts.length === 0 && (
            <Txt>Még nincs mentett saját edzésed — rakd össze az elsőt.</Txt>
          )}

          <div className="em-cwl">
            {customWorkouts.map((w) => (
              <Row key={w.id} as="div" icon="t-dumbbell" title={w.name}
                sub={`${w.exercises.length} gyakorlat · ${w.exercises.reduce((a, e) => a + e.workingSets, 0)} szett`}
                more={(
                  <span className="fo-rowbar">
                    {w.exercises.map((e) => <Caps key={e.id} n={e.workingSets} done={0} color={deepMuscle(e.muscle)} />)}
                  </span>
                )}
                onClick={() => { navigate(`/train/session?day=${w.id}`); close() }}
                right={(
                  <>
                    <Lk aria-label={`${w.name} szerkesztése`} onClick={() => { navigate(`/train/custom/${w.id}`); close() }}>szerkesztés</Lk>
                    <Chev />
                  </>
                )} />
            ))}
          </div>

          <Acts>
            <Btn sm onClick={() => { navigate('/train/custom/new'); close() }}>+ Új összeállítása</Btn>
          </Acts>
        </>
      )}
    </Sheet>
  )
}
