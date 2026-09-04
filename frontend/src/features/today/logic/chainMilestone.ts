// ============================================================
// Mezo · chainMilestone (mezo-sqe3) — „Tökéletes reggel" / „Tökéletes este" as a PURE
// consequence of the tick that closes the daypart, not of a mounted state watcher.
//
// The deleted `useChainCelebration` hook watched a `wasComplete` ref that started false, so an
// already-complete chain rang again on every mount (daypart switch included). That whole class
// of bug is gone here by construction: this function is called INSIDE a tick handler, from the
// state as it stood BEFORE the check, and returns a label only when the row being ticked is the
// last not-done row of its daypart. Nothing observes completion; the act carries it.
//
// The label follows the summary's own vocabulary for the two seeded dayparts (the 30-day
// perfectMorningDays30/perfectEveningDays30 counters mean exactly this), and falls back to a
// plain "kész" sentence for a user-created DAY daypart, which has no counter of its own.
// ============================================================
import type { HabitCatalog, HabitItem } from '@/data/types'

const DAYPART_LABEL = {
  MORNING: 'Tökéletes reggel',
  EVENING: 'Tökéletes este',
  DAY: 'Napközbeni rutin kész',
} as const

/**
 * @param chainKey the ticked habit's chain
 * @param habits   the day's rows AS THEY STAND BEFORE the check (the ticked row still pending)
 * @returns the milestone label when this tick closes the whole daypart, otherwise null
 */
export function daypartMilestone(
  catalog: HabitCatalog,
  habits: HabitItem[],
  chainKey: string,
): string | null {
  const chain = catalog.chains.find((c) => c.chainKey === chainKey)
  if (!chain) return null
  const keys = new Set(catalog.chains.filter((c) => c.daypart === chain.daypart).map((c) => c.chainKey))
  const rows = habits.filter((h) => keys.has(h.chain))
  // Exactly one row left un-done — the one being ticked. A `missed` row is not done either, so
  // a daypart with a missed row honestly earns no milestone.
  const open = rows.filter((h) => h.status !== 'done')
  if (open.length !== 1) return null
  return DAYPART_LABEL[chain.daypart] ?? null
}
