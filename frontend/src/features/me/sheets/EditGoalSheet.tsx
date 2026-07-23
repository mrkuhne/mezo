import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Display } from '@/shared/ui/Display'
import { Icon } from '@/shared/ui/Icon'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'
import { useGoalActions } from '@/data/hooks'
import { FieldRow } from '@/features/me/components/FieldRow'
import type { GoalResponse } from '@/data/me/goalApi'
import type { Goal } from '@/data/types'

// Goal manage sheet (G4b). Opened from the GoalsPage hero. Shows the read-only
// goal fields plus the two destructive management actions the command-center
// needs: Archiválás (archive) + Törlés (remove, behind an inline two-step
// confirm). The meal-cadence + caffeine planner moved to the Fuel settings sheet
// (mezo-53su); the wake/bed anchor lives on the sleep goal (mezo-dbsr). On success
// it closes; the ['goals'] invalidation in useGoalActions makes useGoal refetch —
// when no active goal remains, GoalsPage falls back to its empty state.
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

  return (
    <Sheet onClose={onClose} labelledBy="edit-goal-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Cél kezelése</span>
              <div id="edit-goal-title"><Display size="md">{goal.title}</Display></div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close}><Icon name="x" size={12} /></button>
          </div>

          <div className="col gap-md">
            <FieldRow label="Típus" val="Fogyás · cut" />
            <FieldRow label="Start súly" val={`${goal.startWeight} kg`} />
            <FieldRow label="Cél súly" val={`${goal.targetWeight} kg`} />
            {/* Target/cél pace = rateTargetPctPerWeek (%BW/week → %/hét), NOT the
                observed kg/hét trend the hero shows (mezo-5om). HU decimal comma. */}
            <FieldRow
              label="Cél tempó"
              val={`${String(goal.rateTarget.value).replace('.', ',')} ${goal.rateTarget.unit}`}
            />

            <div className="col gap-sm mt-md">
              <span style={SECTION_LABEL}>Identity frame</span>
              <div className="card" style={{ padding: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{goal.identityFrame}"
                </p>
              </div>
            </div>
          </div>

          {/* Management actions — archive + delete (destructive = var(--error)) */}
          <div className="col gap-sm mt-lg">
            <span style={SECTION_LABEL}>Cél kezelése</span>
            <button
              type="button"
              className="cta-ghost"
              disabled={pending}
              onClick={() => archive(goalId).then(close)}
            >
              Archiválás
            </button>

            {confirmingDelete ? (
              <div className="row gap-sm">
                <button
                  type="button"
                  className="cta-ghost flex-1"
                  disabled={pending}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Mégse
                </button>
                <button
                  type="button"
                  className="cta-primary flex-1"
                  disabled={pending}
                  style={{ background: 'var(--error)', borderColor: 'var(--error)', color: '#fff' }}
                  onClick={() => remove(goalId).then(close)}
                >
                  Biztosan törlöd?
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="cta-ghost"
                disabled={pending}
                style={{ borderColor: 'color-mix(in srgb, var(--error) 30%, transparent)', color: 'var(--error)' }}
                onClick={() => setConfirmingDelete(true)}
              >
                Törlés
              </button>
            )}
          </div>

          <div className="row gap-sm mt-lg">
            <button className="cta-ghost flex-1" onClick={close}>Kész</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
