import type { GamificationProfile } from '@/data/gamification/gamificationTypes'
import { DEFAULT_TITLE_KEY } from '@/data/gamification/titleCatalog'

/** Seed: Lv 12 (3 080 cumulative + 60), one log away from the 7-day streak milestone. */
export const gamificationProfileMock: GamificationProfile = {
  level: 12,
  totalXp: 3140,
  xpInLevel: 60,
  xpForNext: 520,
  coins: 240,
  streakDays: 6,
  streakSavers: 1,
  activeTitleKey: 'fegyelmezett',
  ownedShopTitleKeys: [],
  lastActiveDate: null,
  dayCounters: { date: '', counts: {} },
}

/** Real-mode empty (dual-mode invariant): never the mock seed. */
export const GHOST_GAMIFICATION: GamificationProfile = {
  level: 1,
  totalXp: 0,
  xpInLevel: 0,
  xpForNext: 80,
  coins: 0,
  streakDays: 0,
  streakSavers: 0,
  activeTitleKey: DEFAULT_TITLE_KEY,
  ownedShopTitleKeys: [],
  lastActiveDate: null,
  dayCounters: { date: '', counts: {} },
}
