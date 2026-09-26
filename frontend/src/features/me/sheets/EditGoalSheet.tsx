import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { useGoalActions } from '@/data/hooks'
import type { GoalResponse } from '@/data/me/goalApi'
import type { Goal } from '@/data/types'

// Goal manage sheet (G4b). Opened from the GoalsPage hero. Shows the read-only
// goal fields plus the two destructive management actions the command-center
// needs: Archiválás (archive) + Törlés (remove, behind an inline two-step
// confirm). The meal-cadence + caffeine planner moved to the Fuel settings sheet
// (mezo-53su); the wake/bed anchor lives on the sleep goal (mezo-dbsr). On success
// it closes; the ['goals'] invalidation in useGoalActions makes useGoal refetch —
// when no active goal remains, GoalsPage falls back to its empty state.
// Üveg (U10, mezo-me75u.10): a rose glass sheet (Én), the target 3D head, the goal fields as flat
// cells, the identity frame as an upright quote cell (bible rule 23), Archiválás flat ghost,
// Törlés the coral outline (a destructive action keeps its warning tone, rule 29).
export function EditGoalSheet({
  onClose,
  goal,
  goalId,
}: {
  onClose: () => void
  goal: Goal
  // Kept on the prop contract (the wire round-trips mealsPerDay/wake/bed via
  // goalResponseToUpsert) but no longer read here since the planner section moved
  // to the Fuel settings sheet (mezo-53su).
  goalResponse: GoalResponse
  goalId: string
}) {
  const { archive, remove, pending } = useGoalActions()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const rows: [string, string][] = [
    ['Típus', 'Fogyás · cut'],
    ['Start súly', `${goal.startWeight} kg`],
    ['Cél súly', `${goal.targetWeight} kg`],
    // Target/cél pace = rateTargetPctPerWeek (%BW/week → %/hét), NOT the
    // observed kg/hét trend the hero shows (mezo-5om). HU decimal comma.
    ['Cél tempó', `${String(goal.rateTarget.value).replace('.', ',')} ${goal.rateTarget.unit}`],
  ]

  return (
    <Sheet glass onClose={onClose} labelledBy="edit-goal-title" className="uvl-en">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-target" eyebrow="Cél kezelése" title={goal.title} titleId="edit-goal-title" onClose={close} />

          <div className="uvl-rows">
            {rows.map(([label, val]) => (
              <div key={label} className="uvl-cell">
                <span className="uvl-flabel">{label}</span>
                <span className="uvl-cell-v">{val}</span>
              </div>
            ))}
          </div>

          <div className="uvl-field">
            <span className="uvl-flabel">Identity frame</span>
            <p className="uvl-quote">"{goal.identityFrame}"</p>
          </div>

          {/* Management actions — archive + delete (destructive keeps its coral warning tone) */}
          <div className="uvl-field">
            <span className="uvl-flabel">Cél kezelése</span>
            <button type="button" className="uvl-ghost" disabled={pending} onClick={() => archive(goalId).then(close)}>
              Archiválás
            </button>

            {confirmingDelete ? (
              <div className="uvl-foot">
                <button type="button" className="uvl-ghost" disabled={pending} onClick={() => setConfirmingDelete(false)}>
                  Mégse
                </button>
                <button type="button" className="uvl-warn is-armed" disabled={pending} onClick={() => remove(goalId).then(close)}>
                  Biztosan törlöd?
                </button>
              </div>
            ) : (
              <button type="button" className="uvl-warn" disabled={pending} onClick={() => setConfirmingDelete(true)}>
                Törlés
              </button>
            )}
          </div>

          <button type="button" className="uvl-ghost is-wide" onClick={close}>Kész</button>
        </div>
      )}
    </Sheet>
  )
}
