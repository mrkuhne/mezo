/** Consecutive days with ≥1 gratitude entry, walking back from today (or yesterday if today is empty). Derived, never stored. */
export function gratitudeStreakDays(occurredOnDates: readonly string[], todayIso: string): number {
  const days = new Set(occurredOnDates)
  const cursor = new Date(`${todayIso}T00:00:00Z`)
  if (!days.has(todayIso)) cursor.setUTCDate(cursor.getUTCDate() - 1)
  let streak = 0
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}
