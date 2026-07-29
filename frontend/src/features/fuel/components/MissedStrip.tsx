import type { FuelSlot } from '@/data/types'

// Missed-window strip (mezo-rrtj). buildDayPlan guarantees at most one `now`, so a missed window is
// never the day's single actionable thing — it is an ADDITIONAL affordance next to the hero, not a
// replacement for it. Only the earliest one gets a CTA; the rest are counted, so a badly-tracked
// day cannot bury the hero under a stack of amber strips.
export function MissedStrip({
  slots,
  onLogMeal,
}: {
  slots: FuelSlot[]
  onLogMeal: (slot: FuelSlot) => void
}) {
  const [first, ...rest] = slots
  if (!first) return null
  return (
    <div className="missedstrip">
      <span aria-hidden="true">⚠</span>
      <span className="mt">
        {first.label} kimaradt{first.kcal != null ? ` · ${first.kcal} kcal` : ''}
        {rest.length > 0 ? ` · +${rest.length} másik` : ''}
      </span>
      <button type="button" aria-label={`${first.label} pótlása`} onClick={() => onLogMeal(first)}>
        Pótlás
      </button>
    </div>
  )
}
