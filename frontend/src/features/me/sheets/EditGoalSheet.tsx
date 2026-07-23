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
// goal fields, an editable "Napi ritmus" day-planner section (Fuel P5), plus the
// two destructive management actions the command-center needs: Archiválás
// (archive) + Törlés (remove, behind an inline two-step confirm). On success it
// closes; the ['goals'] invalidation in useGoalActions makes useGoal refetch —
// when no active goal remains, GoalsPage falls back to its empty state.
export function EditGoalSheet({
  onClose,
  goal,
  goalResponse,
  goalId,
}: {
  onClose: () => void
  goal: Goal
  goalResponse: GoalResponse
  goalId: string
}) {
  const { archive, remove, savePlanner, pending } = useGoalActions()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Day-planner state (Fuel P5) — the meal cadence only; the wake/bed anchor moved
  // to the sleep goal (mezo-dbsr), edited on the Alvás page. Default 4 when unset.
  const [mealsPerDay, setMealsPerDay] = useState(goal.mealsPerDay ?? 4)

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

          {/* Napi ritmus (Fuel P5) — the goal's meal cadence (étkezés/nap stepper,
              3–6). The wake/bed anchor moved to the sleep goal (mezo-dbsr); Save PUTs
              the full goal with the meal override (window/weights + the wire-preserved
              wake/bed passed through) via useGoalActions. */}
          <div className="col gap-sm mt-lg">
            <span style={SECTION_LABEL}>Napi ritmus</span>

            {/* Étkezés/nap stepper — clamped 3..6 */}
            <div
              className="row"
              style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}
            >
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>Étkezés/nap</span>
              <div className="row gap-sm" style={{ alignItems: 'center' }}>
                <button
                  type="button"
                  className="chip"
                  aria-label="Étkezés csökkentése"
                  disabled={mealsPerDay <= 3}
                  onClick={() => setMealsPerDay((v) => Math.max(3, v - 1))}
                  style={{ opacity: mealsPerDay <= 3 ? 0.4 : 1 }}
                >
                  <Icon name="minus" size={12} />
                </button>
                <span
                  aria-label={`Étkezés/nap ${mealsPerDay}`}
                  style={{ minWidth: 18, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {mealsPerDay}
                </span>
                <button
                  type="button"
                  className="chip"
                  aria-label="Étkezés növelése"
                  disabled={mealsPerDay >= 6}
                  onClick={() => setMealsPerDay((v) => Math.min(6, v + 1))}
                  style={{ opacity: mealsPerDay >= 6 ? 0.4 : 1 }}
                >
                  <Icon name="plus" size={12} />
                </button>
              </div>
            </div>

            {/* The wake/bed anchor moved to the sleep goal (mezo-dbsr) — point at its new home. */}
            <span style={{ fontSize: 9, color: 'var(--faint)' }}>Az ébredés/lefekvés horgony az Alvás oldalon állítható.</span>

            <button
              type="button"
              className="cta-primary"
              disabled={pending}
              style={{ opacity: pending ? 0.5 : 1 }}
              onClick={() => savePlanner(goalId, goalResponse, { mealsPerDay }).then(close)}
            >
              <Icon name="check" size={14} /> Ritmus mentése
            </button>
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
