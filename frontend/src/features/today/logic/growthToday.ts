import type { ActivityEntry, DailyQuest } from '@/data/types'

export interface GrowthTodaySummary {
  done: number
  total: number
  xp: number
}

/**
 * Today's growth-at-a-glance summary — the `TodayQuestsCard` header (done/total · +XP,
 * mezo-gj2y; previously the retired GrowthTodayRow's line). xp = Σ xp on completed quests
 * + Σ xpAwarded on today's activity entries (0 for uncategorized rows — no special-casing).
 */
export function growthTodaySummary(quests: DailyQuest[], entries: ActivityEntry[]): GrowthTodaySummary {
  const completed = quests.filter((q) => q.status === 'completed')
  const questXp = completed.reduce((sum, q) => sum + q.xp, 0)
  const activityXp = entries.reduce((sum, e) => sum + e.xpAwarded, 0)
  return { done: completed.length, total: quests.length, xp: questXp + activityXp }
}
