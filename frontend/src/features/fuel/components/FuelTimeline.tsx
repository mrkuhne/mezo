import type { FuelSlot, FuelMeal } from '@/data/types'
import { TimelineSlot } from '@/features/fuel/components/TimelineSlot'

export function FuelTimeline({
  slots,
  getScoredMeal,
  onOpenScore,
}: {
  slots: FuelSlot[]
  getScoredMeal: (s: FuelSlot) => FuelMeal | null
  onOpenScore: (m: FuelMeal) => void
}) {
  return (
    <div className="col" style={{ gap: 0 }}>
      {slots.map((slot, i) => (
        <TimelineSlot
          key={i}
          slot={slot}
          isLast={i === slots.length - 1}
          scoredMeal={getScoredMeal(slot)}
          onOpenScore={onOpenScore}
        />
      ))}
    </div>
  )
}
