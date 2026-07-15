import type { FuelSlot, FuelMeal } from '@/data/types'
import { KIND_META } from '@/data/kindMeta'
import { SlotCard } from '@/features/fuel/components/SlotCard'

export function FuelTimeline({
  slots,
  getScoredMeal,
  onOpenScore,
  onLogMeal,
}: {
  slots: FuelSlot[]
  getScoredMeal: (s: FuelSlot) => FuelMeal | null
  onOpenScore: (m: FuelMeal) => void
  onLogMeal?: (slot: FuelSlot) => void
}) {
  return (
    <div className="col" style={{ gap: 0 }}>
      {slots.map((slot, i) => (
        <SlotCard
          key={i}
          slot={slot}
          meta={KIND_META[slot.kind] ?? KIND_META.meal}
          scoredMeal={getScoredMeal(slot)}
          onOpenScore={onOpenScore}
          onLogMeal={onLogMeal}
        />
      ))}
    </div>
  )
}
