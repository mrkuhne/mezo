import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { gamificationApi } from '@/data/gamification/gamificationApi'
import { mockGamificationDay } from '@/data/gamification/gamificationDayMock'
import { GHOST_GAMIFICATION, gamificationProfileMock } from '@/data/gamification/gamificationMock'
import {
  GAMIFICATION_KEY,
  MAX_SAVERS,
  SAVER_PRICE,
} from '@/data/gamification/gamificationStore'
import type { GamificationDay, GamificationProfile, Title } from '@/data/gamification/gamificationTypes'
import { TITLE_CATALOG } from '@/data/gamification/titleCatalog'
import { useDualQuery } from '@/data/useDualQuery'

const EMPTY_DAY = (date: string): GamificationDay => ({
  date,
  xpBySource: [],
  xpTotal: 0,
  coinEvents: [],
  coinTotal: 0,
  streakDays: 0,
  streakAlive: false,
})

export function useGamification(): { profile: GamificationProfile; isPending: boolean } {
  const { data, isPending } = useDualQuery<GamificationProfile>({
    queryKey: [...GAMIFICATION_KEY],
    mockData: gamificationProfileMock,
    realFetch: async () => {
      try {
        return await gamificationApi.profile()
      } catch (err) {
        // 404 = gamification switch off / no profile yet → ghost, not an error (no retry).
        if (err instanceof ApiError && err.status === 404) return GHOST_GAMIFICATION
        throw err
      }
    },
    realEmpty: GHOST_GAMIFICATION,
    realStaleTime: 60_000,
  })
  return { profile: data, isPending }
}

export function useTitles(): { titles: Title[] } {
  const { profile } = useGamification()
  const titles = TITLE_CATALOG.map((t) => ({
    ...t,
    owned:
      t.kind === 'LADDER'
        ? profile.level >= (t.unlockLevel ?? 1)
        : profile.ownedShopTitleKeys.includes(t.key),
    equipped: t.key === profile.activeTitleKey,
  }))
  return { titles }
}

/** The day's XP-by-source + coin events + streak (spec §9, the Harvest read). Mock mode
 *  seeds the approved mockup numbers deterministically; real mode reads the backend day
 *  aggregate — honest zeros while unresolved, never the mock seed. */
export function useGamificationDay(date: string): { data: GamificationDay; isPending: boolean } {
  return useDualQuery<GamificationDay>({
    queryKey: ['gamificationDay', date],
    mockData: mockGamificationDay(date),
    realFetch: () => gamificationApi.day(date),
    realEmpty: EMPTY_DAY(date),
  })
}

/** Gamification mutations (spec §8/§9). Mock mode patches the cached profile directly
 *  (byte-identical to the Phase-1 logic); real mode calls the backend and invalidates the
 *  profile query — errors are NOT swallowed, they propagate to the app's global
 *  mutation-cache error toast (see QueryProvider). buyTitle auto-equips. */
export function useGamificationActions(): {
  buyTitle: (key: string) => void
  equipTitle: (key: string) => void
  buyStreakSaver: () => void
  canMutate: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()
  const patch = (fn: (p: GamificationProfile) => GamificationProfile) => {
    qc.setQueryData<GamificationProfile>(GAMIFICATION_KEY, (p) => fn(p ?? gamificationProfileMock))
  }
  const invalidate = () => qc.invalidateQueries({ queryKey: GAMIFICATION_KEY })

  const buyTitleM = useMutation({
    mutationFn: (key: string) => gamificationApi.buyTitle(key),
    onSuccess: invalidate,
  })
  const equipTitleM = useMutation({
    mutationFn: (key: string) => gamificationApi.equipTitle(key),
    onSuccess: invalidate,
  })
  const buySaverM = useMutation({
    mutationFn: () => gamificationApi.buySaver(),
    onSuccess: invalidate,
  })

  return {
    canMutate: true,
    buyTitle: (key) => {
      if (!mock) {
        buyTitleM.mutate(key)
        return
      }
      patch((p) => {
        const t = TITLE_CATALOG.find((x) => x.key === key)
        if (!t || t.kind !== 'SHOP' || p.ownedShopTitleKeys.includes(key)) return p
        if (p.coins < (t.priceCoins ?? 0)) return p
        return {
          ...p,
          coins: p.coins - (t.priceCoins ?? 0),
          ownedShopTitleKeys: [...p.ownedShopTitleKeys, key],
          activeTitleKey: key,
        }
      })
    },
    equipTitle: (key) => {
      if (!mock) {
        equipTitleM.mutate(key)
        return
      }
      patch((p) => {
        const t = TITLE_CATALOG.find((x) => x.key === key)
        if (!t) return p
        const owned =
          t.kind === 'LADDER' ? p.level >= (t.unlockLevel ?? 1) : p.ownedShopTitleKeys.includes(key)
        return owned ? { ...p, activeTitleKey: key } : p
      })
    },
    buyStreakSaver: () => {
      if (!mock) {
        buySaverM.mutate()
        return
      }
      patch((p) =>
        p.coins >= SAVER_PRICE && p.streakSavers < MAX_SAVERS
          ? { ...p, coins: p.coins - SAVER_PRICE, streakSavers: p.streakSavers + 1 }
          : p,
      )
    },
  }
}
