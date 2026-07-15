import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Display } from '@/shared/ui/Display'
import { Icon } from '@/shared/ui/Icon'
import { useGoalActions } from '@/data/hooks'
import { FieldRow } from '@/features/me/components/FieldRow'
import type { GoalResponse } from '@/data/me/goalApi'
import type { Goal } from '@/data/types'

// Jakarta section-label idiom (Napiv, replaces the retired mono `label-mono` class).
const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
}

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
  // Day-planner state (Fuel P5) — defaults from the loaded goal, else 4/06:00/23:00.
  const [mealsPerDay, setMealsPerDay] = useState(goal.mealsPerDay ?? 4)
  const [wakeTime, setWakeTime] = useState(goal.wakeTime ?? '06:00')
  const [bedTime, setBedTime] = useState(goal.bedTime ?? '23:00')

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
              <div className="card notch-4" style={{ padding: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{goal.identityFrame}"
                </p>
              </div>
            </div>
          </div>

          {/* Napi ritmus (Fuel P5) — the goal's day-planner settings: étkezés/nap
              stepper (3–6) + wake/bed time anchors. Save PUTs the full goal with
              these overrides (window/weights preserved) via useGoalActions. */}
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

            {/* Wake / bed time anchors */}
            <div
              className="row"
              style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}
            >
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>Ébredés</span>
              <input
                type="time"
                aria-label="Ébredés"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontVariantNumeric: 'tabular-nums', colorScheme: 'dark' }}
              />
            </div>
            <div
              className="row"
              style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}
            >
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>Lefekvés</span>
              <input
                type="time"
                aria-label="Lefekvés"
                value={bedTime}
                onChange={(e) => setBedTime(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontVariantNumeric: 'tabular-nums', colorScheme: 'dark' }}
              />
            </div>

            <button
              type="button"
              className="cta-primary notch-4"
              disabled={pending}
              style={{ opacity: pending ? 0.5 : 1 }}
              onClick={() => savePlanner(goalId, goalResponse, { mealsPerDay, wakeTime, bedTime }).then(close)}
            >
              <Icon name="check" size={14} /> Ritmus mentése
            </button>
          </div>

          {/* Management actions — archive + delete (destructive = var(--error)) */}
          <div className="col gap-sm mt-lg">
            <span style={SECTION_LABEL}>Cél kezelése</span>
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
