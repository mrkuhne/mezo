import type { FuelMeal } from '@/data/types'
import { toneOf } from '@/features/fuel/logic/scoreTone'

// AI score chip (mezo-rrtj) — replaces SlotCard's bare `AI 74`. The score itself is deterministic
// and arrives WITH the write (P7), so it is never "computing"; the seconds-long LLM step is the
// coach verdict, which is why a pending coach only adds a twinkle beside a final number.
const RING_R = 8
const RING_C = 2 * Math.PI * RING_R


export function MealScoreChip({
  meal,
  coachPending,
  onOpen,
}: {
  meal: FuelMeal | null
  /** The coach verdict for this meal is still in flight (useMealCoach().isPending). */
  coachPending?: boolean
  onOpen: (meal: FuelMeal) => void
}) {
  if (!meal || meal.score == null) return null
  const pct = Math.round(meal.score * 100)
  const tone = toneOf(pct)
  return (
    <button
      type="button"
      aria-label="AI score"
      className={`aiscore ${tone.cls}`}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(meal)
      }}
    >
      <svg className="rg" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r={RING_R} fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="3" />
        <circle
          cx="10" cy="10" r={RING_R} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${((pct / 100) * RING_C).toFixed(1)} ${RING_C.toFixed(1)}`}
          transform="rotate(-90 10 10)"
        />
      </svg>
      {pct} · {tone.word}
      {coachPending && (
        <span data-testid="coach-twinkle" className="np-twinkle" aria-hidden="true">✨</span>
      )}
    </button>
  )
}
