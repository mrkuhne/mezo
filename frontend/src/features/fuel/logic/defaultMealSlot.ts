import type { MealSlot } from '@/data/types'

/**
 * Wall-clock fallback slot for a log opened with no launching-window context (the standing
 * out-of-window log row, Kamra detail's ＋ Logolás). A log opened FROM a window must instead
 * carry THAT window's own slotKey (mezo-bnsf) — this is only the last-resort default when there
 * is no window to inherit from. Shared by LogMealSheet (legacy, until F8) and LogFlowPage so the
 * one rule holds in both places.
 */
export function defaultMealSlot(now: Date = new Date()): MealSlot {
  const h = now.getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
