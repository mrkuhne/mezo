// ============================================================
// Mezo · MusclePriorityPicker — the whole tier UX for a mesocycle (mezo-3m5m,
// spec GD4; Folyadék mezo-n4wf5.3, prototype vilagos/edzes.js `ujterv()` → „Fókusz"):
// pick 1–2 Hangsúly groups, optionally mark Tartás, everything else defaults Építés.
// One row per TIER_GROUPS entry: the muscle chip, the name, a 3-way segmented control
// (real <button>s, aria-pressed). Hangsúly disables (not hides) once EMPHASIZE_CAP groups
// are already emphasized elsewhere — the already-emphasized rows stay enabled so they can
// be toggled back off. Inline in the interview's card: it draws no card of its own.
// ============================================================
import { Mchp } from '@/features/train/components/folyadek'
import { EMPHASIZE_CAP, TIER_GROUPS, setTier, tierOf } from '@/features/train/logic/musclePriorities'
import { BUDGET_GROUP_LABELS } from '@/features/train/logic/setBudget'
import { TIER_LABEL } from '@/features/train/logic/tierLabel'
import type { MusclePriorities, MuscleTier } from '@/data/types'
import { Note, Txt } from '@/shared/ui/folyadek'

const TIERS: MuscleTier[] = ['emphasize', 'grow', 'maintain']

interface MusclePriorityPickerProps {
  value: MusclePriorities
  onChange: (next: MusclePriorities) => void
}

export function MusclePriorityPicker({ value, onChange }: MusclePriorityPickerProps) {
  const emphasizeCount = Object.values(value ?? {}).filter((t) => t === 'emphasize').length

  return (
    <>
      <Txt className="ew-prh">Mire gyúr ez a terv?</Txt>
      <Note>Válassz 1–2 hangsúlyt — a többi magától nő, a Tartás szinten tart.</Note>

      {TIER_GROUPS.map((group) => {
        const label = BUDGET_GROUP_LABELS[group] ?? group
        const current = tierOf(value, group)

        return (
          <div key={group} className="ew-pr">
            <Mchp muscle={group} sm />
            <span className="l">{label}</span>
            <span role="group" aria-label={`${label} prioritás`} className="ew-tri">
              {TIERS.map((tier) => {
                const pressed = current === tier
                const disabled = tier === 'emphasize' && !pressed && emphasizeCount >= EMPHASIZE_CAP
                return (
                  <button
                    key={tier}
                    type="button"
                    aria-pressed={pressed}
                    disabled={disabled}
                    onClick={() => onChange(setTier(value ?? {}, group, tier))}
                  >
                    {TIER_LABEL[tier]}
                  </button>
                )
              })}
            </span>
          </div>
        )
      })}
    </>
  )
}
