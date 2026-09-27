// ============================================================
// Mezo · todayItems — the check-in slot predicate the Nap pages share (mezo-mvb4.1).
// The module once held `buildTodayItems`, the normalizer behind the retired Today faces
// (mezo-ly8c); nothing rendered it any more, so it went in the dead-code sweep (mezo-8slef).
// What stays is the one predicate four live surfaces import.
// ============================================================
import type { CheckinSlot } from '@/data/types'

/** A check-in slot the user can still fill — anything not already recorded. `skipped` counts:
 *  its window has passed, but `CheckInSheet` posts `state: 'done'`, so a backfill lands. The one
 *  predicate behind both the quest CTA's servability and the index `act()` opens for it, so the
 *  two can never disagree about what „a slot is available" means (mezo-mvb4.1). */
export const isFillableSlot = (c: CheckinSlot): boolean => c.state !== 'done'
