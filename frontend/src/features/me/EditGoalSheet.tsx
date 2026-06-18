import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { LabelMono } from '@/components/ui/LabelMono'
import { Icon } from '@/components/ui/Icon'
import { useGoalActions } from '@/data/hooks'
import { FieldRow } from './components/FieldRow'
import type { Goal } from '@/data/types'

// Goal manage sheet (G4b). Opened from the GoalsView hero. Shows the read-only
// goal fields, plus the two destructive management actions the command-center
// needs: Archiválás (archive) + Törlés (remove, behind an inline two-step confirm).
// On success it closes; the ['goals'] invalidation in useGoalActions makes useGoal
// refetch — when no active goal remains, GoalsView falls back to its empty state.
export function EditGoalSheet({
  onClose,
  goal,
  goalId,
}: {
  onClose: () => void
  goal: Goal
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
              <Eyebrow brand>Cél kezelése</Eyebrow>
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
              <LabelMono>Identity frame</LabelMono>
              <div className="card notch-4" style={{ padding: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{goal.identityFrame}"
                </p>
              </div>
            </div>
          </div>

          {/* Management actions — archive + delete (destructive = var(--error)) */}
          <div className="col gap-sm mt-lg">
            <LabelMono>Cél kezelése</LabelMono>
            <button
              type="button"
              className="cta-ghost notch-4"
              disabled={pending}
              onClick={() => archive(goalId).then(close)}
            >
              Archiválás
            </button>

            {confirmingDelete ? (
              <div className="row gap-sm">
                <button
                  type="button"
                  className="cta-ghost notch-4 flex-1"
                  disabled={pending}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Mégse
                </button>
                <button
                  type="button"
                  className="cta-primary notch-4 flex-1"
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
                className="cta-ghost notch-4"
                disabled={pending}
                style={{ borderColor: 'color-mix(in srgb, var(--error) 30%, transparent)', color: 'var(--error)' }}
                onClick={() => setConfirmingDelete(true)}
              >
                Törlés
              </button>
            )}
          </div>

          <div className="row gap-sm mt-lg">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>Kész</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
