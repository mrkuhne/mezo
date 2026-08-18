/** Account-wide gamification domain (spec §4.1). Frontend-first: mock lives in the
 *  TanStack cache; real mode is derived/ghost until the backend slice (mezo-huzd). */
export type XpEventType =
  | 'MEAL' | 'WEIGHT' | 'SLEEP' | 'CHECKIN' | 'MEDICATION'
  | 'GYM' | 'RUN' | 'SPORT' | 'QUEST' | 'ACTIVITY' | 'HABIT' | 'NEEDS_CLOSE'

export type GamificationProfile = {
  level: number
  totalXp: number
  xpInLevel: number
  xpForNext: number
  coins: number
  streakDays: number
  /** Whether today still keeps the streak alive (honest flame state, mezo-huzd). */
  streakAlive: boolean
  /** Held streak savers, 0..2 (spec §6.2). */
  streakSavers: number
  activeTitleKey: string
  ownedShopTitleKeys: string[]
  /** Last day (local ISO date) that earned XP; null = seeded state (treated as yesterday). */
  lastActiveDate: string | null
  /** Per-day award counters for the daily caps (spec §5.1). */
  dayCounters: { date: string; counts: Partial<Record<XpEventType, number>> }
}

export type Title = {
  key: string
  name: string
  kind: 'LADDER' | 'SHOP'
  unlockLevel?: number
  priceCoins?: number
  owned: boolean
  equipped: boolean
}

/** The day's XP-by-source + coin events + streak — the ritual Harvest read (mezo-huzd R3). */
export type GamificationDay = {
  date: string
  xpBySource: { source: XpEventType; xp: number }[]
  xpTotal: number
  coinEvents: { reason: string; amount: number }[]
  coinTotal: number
  streakDays: number
  streakAlive: boolean
}
