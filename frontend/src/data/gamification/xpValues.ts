import type { XpEventType } from '@/data/gamification/gamificationTypes'

/** Flat XP per log event (spec §5.1). QUEST/ACTIVITY/HABIT carry their own XP via xpOverride. */
export const XP_VALUES: Record<XpEventType, number> = {
  MEAL: 10, WEIGHT: 10, SLEEP: 10, CHECKIN: 10, MEDICATION: 5,
  GYM: 40, RUN: 30, SPORT: 30, QUEST: 0, ACTIVITY: 0, HABIT: 0,
}

/** Daily award caps — farming guard (spec §5.1). Counter resets at local midnight. */
export const DAILY_CAPS: Record<XpEventType, number> = {
  MEAL: 5, WEIGHT: 1, SLEEP: 1, CHECKIN: 1, MEDICATION: 3,
  GYM: 1, RUN: 2, SPORT: 2, QUEST: 3, ACTIVITY: 10, HABIT: 10,
}

export function xpForEvent(type: XpEventType, countToday: number, xpOverride?: number): number {
  if (countToday >= DAILY_CAPS[type]) return 0
  return xpOverride ?? XP_VALUES[type]
}
