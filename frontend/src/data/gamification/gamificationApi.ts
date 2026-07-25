import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { GamificationDay, GamificationProfile } from '@/data/gamification/gamificationTypes'

type ProfileWire = components['schemas']['GamificationProfileResponse']
type DayWire = components['schemas']['GamificationDayResponse']

const toProfile = (w: ProfileWire): GamificationProfile => ({
  level: w.level,
  totalXp: w.totalXp,
  xpInLevel: w.xpInLevel,
  xpForNext: w.xpForNext,
  coins: w.coins,
  streakDays: w.streakDays,
  streakSavers: w.streakSavers,
  activeTitleKey: w.equippedTitleKey,
  ownedShopTitleKeys: w.ownedTitleKeys,
  lastActiveDate: null,
  dayCounters: { date: '', counts: {} },
})

const toDay = (w: DayWire): GamificationDay => ({
  date: w.date,
  xpBySource: w.xpBySource as GamificationDay['xpBySource'],
  xpTotal: w.xpTotal,
  coinEvents: w.coinEvents,
  coinTotal: w.coinTotal,
  streakDays: w.streakDays,
  streakAlive: w.streakAlive,
})

/** Real-mode gamification endpoints (mezo-huzd Task 5/7): account profile, the day
 *  Harvest read, and the three mutations (shop buy, equip, streak-saver buy) —
 *  every write echoes the fresh profile so callers can invalidate and refetch. */
export const gamificationApi = {
  profile: async (): Promise<GamificationProfile> =>
    toProfile(await apiFetch<ProfileWire>('/api/gamification/profile')),
  day: async (date: string): Promise<GamificationDay> =>
    toDay(await apiFetch<DayWire>(`/api/gamification/day/${date}`)),
  buyTitle: (key: string): Promise<ProfileWire> =>
    apiFetch<ProfileWire>(`/api/gamification/title/${key}/buy`, { method: 'POST' }),
  equipTitle: (key: string): Promise<ProfileWire> =>
    apiFetch<ProfileWire>(`/api/gamification/title/${key}/equip`, { method: 'POST' }),
  buySaver: (): Promise<ProfileWire> =>
    apiFetch<ProfileWire>('/api/gamification/saver/buy', { method: 'POST' }),
}
