// ============================================================
// Mezo · MusclePriorityPicker — the whole tier UX for a mesocycle (mezo-3m5m,
// spec GD4): pick 1–2 Emphasize groups, optionally mark Maintain, everything
// else defaults Grow. One row per TIER_GROUPS entry, a 3-way segmented
// control per row (real <button>s, aria-pressed). Emphasize disables (not
// hides) once EMPHASIZE_CAP groups are already emphasized elsewhere — the
// already-emphasized rows stay enabled so they can be toggled back off.
// Tier names stay English (RP terminology); surrounding copy is Hungarian.
// Visual idiom copied from SetBudgetCard's pills (muscleColor washes) and
// the wizard's split-card segmented tabs (.segtab) — no new CSS.
// ============================================================
import { muscleColor } from '@/features/train/logic/muscleColors'
import { EMPHASIZE_CAP, TIER_GROUPS, TIER_LABELS, setTier, tierOf } from '@/features/train/logic/musclePriorities'
import { BUDGET_GROUP_LABELS } from '@/features/train/logic/setBudget'
import type { MusclePriorities, MuscleTier } from '@/data/types'

const TIERS: MuscleTier[] = ['emphasize', 'grow', 'maintain']

interface MusclePriorityPickerProps {
  value: MusclePriorities
  onChange: (next: MusclePriorities) => void
}

export function MusclePriorityPicker({ value, onChange }: MusclePriorityPickerProps) {
  const emphasizeCount = Object.values(value ?? {}).filter((t) => t === 'emphasize').length

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="col" style={{ gap: 4, marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Mire gyúr ez a blokk?</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
          Válassz 1–2 hangsúlyt — a többi magától nő, a Maintain szinten tart.
        </span>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {TIER_GROUPS.map((group) => {
          const label = BUDGET_GROUP_LABELS[group] ?? group
          const current = tierOf(value, group)
          const fam = muscleColor(group)

          return (
            <div key={group} className="row" style={{ gap: 10, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 999,
                  background: fam.wash, color: fam.deep, flexShrink: 0, minWidth: 72, textAlign: 'center',
                }}
              >
                {label}
              </span>
              <div
                role="group"
                aria-label={`${label} prioritás`}
                className="row gap-xs"
                style={{ flex: 1 }}
              >
                {TIERS.map((tier) => {
                  const pressed = current === tier
                  const disabled = tier === 'emphasize' && !pressed && emphasizeCount >= EMPHASIZE_CAP
                  return (
                    <button
                      key={tier}
                      type="button"
                      className="segtab"
                      aria-pressed={pressed}
                      disabled={disabled}
                      onClick={() => onChange(setTier(value ?? {}, group, tier))}
                      style={{ flex: 1, padding: '6px 8px', fontSize: 12.5 }}
                    >
                      {TIER_LABELS[tier]}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
