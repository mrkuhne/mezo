import { useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { fetchDerivedGamification } from '@/data/gamification/gamificationApi'
import { GHOST_GAMIFICATION, gamificationProfileMock } from '@/data/gamification/gamificationMock'
import {
  GAMIFICATION_KEY,
  MAX_SAVERS,
  SAVER_PRICE,
} from '@/data/gamification/gamificationStore'
import type { GamificationProfile, Title } from '@/data/gamification/gamificationTypes'
import { TITLE_CATALOG } from '@/data/gamification/titleCatalog'
import { useDualQuery } from '@/data/useDualQuery'

export function useGamification(): { profile: GamificationProfile; isPending: boolean } {
  const { data, isPending } = useDualQuery<GamificationProfile>({
    queryKey: [...GAMIFICATION_KEY],
    mockData: gamificationProfileMock,
    realFetch: fetchDerivedGamification,
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

/** Mock-only mutations (spec §8: real mode disabled until mezo-huzd). buyTitle auto-equips. */
export function useGamificationActions(): {
  buyTitle: (key: string) => void
  equipTitle: (key: string) => void
  buyStreakSaver: () => void
  canMutate: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()
  const patch = (fn: (p: GamificationProfile) => GamificationProfile) => {
    if (!mock) return
    qc.setQueryData<GamificationProfile>(GAMIFICATION_KEY, (p) =>
      fn(p ?? gamificationProfileMock),
    )
  }
  return {
    canMutate: mock,
    buyTitle: (key) =>
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
      }),
    equipTitle: (key) =>
      patch((p) => {
        const t = TITLE_CATALOG.find((x) => x.key === key)
        if (!t) return p
        const owned =
          t.kind === 'LADDER' ? p.level >= (t.unlockLevel ?? 1) : p.ownedShopTitleKeys.includes(key)
        return owned ? { ...p, activeTitleKey: key } : p
      }),
    buyStreakSaver: () =>
      patch((p) =>
        p.coins >= SAVER_PRICE && p.streakSavers < MAX_SAVERS
          ? { ...p, coins: p.coins - SAVER_PRICE, streakSavers: p.streakSavers + 1 }
          : p,
      ),
  }
}
