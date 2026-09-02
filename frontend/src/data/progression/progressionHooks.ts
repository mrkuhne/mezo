import { useDualQuery } from '@/data/useDualQuery'
import { progressionApi } from '@/data/progression/progressionApi'
import type { GrowthWeek } from '@/data/progression/progressionApi'
import { ApiError } from '@/data/_client/api'
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from '@/data/progression/progressionMock'
import { achievementsMock } from '@/data/progression/achievementsMock'
import { growthWeekMock } from '@/data/progression/growthWeekMock'

/**
 * Athletic + muscle progression profile (radar, athlete-level, streak, highlights).
 * Dual-mode: a seeded fixture in mock mode, the real `GET /api/progression/profile`
 * in real mode; a 404 (progression switch off) resolves to the ghost profile
 * (`athleteLevel === null`) — caught here (like the biometric hook) so the
 * switch-off state is a clean "not set up", not a retried error.
 */
export function useProgressionProfile() {
  return useDualQuery({
    queryKey: ['progressionProfile'],
    mockData: progressionProfileMock,
    realFetch: async () => {
      try {
        return await progressionApi.getProfile()
      } catch (err) {
        // 404 = progression switch off / no profile yet → ghost, not an error (no retry).
        if (err instanceof ApiError && err.status === 404) return GHOST_PROGRESSION_PROFILE
        throw err
      }
    },
    realEmpty: GHOST_PROGRESSION_PROFILE,
    realStaleTime: 60_000,
  })
}

/**
 * Growth achievements (badges + unlocked perks) for the Me Growth page.
 * Dual-mode: the seeded 4/9 mockup state in mock mode, the real
 * `GET /api/progression/achievements` in real mode. Honest empty (no badges/perks)
 * while unresolved — never the seed.
 */
export function useAchievements() {
  return useDualQuery({
    queryKey: ['achievements'],
    mockData: achievementsMock,
    realFetch: () => progressionApi.getAchievements(),
    realEmpty: { badges: [], perks: [] },
    realStaleTime: 60_000,
  })
}

/**
 * The Growth Napló page's "Ez a hét" tile (mezo-rmi0.1) — the first consumer of the live
 * `GET /api/progression/growth-week/{date}` endpoint (unconsumed since mezo-p2tr).
 * `null` = nothing to draw (unresolved, 404, or error) — the tile renders NOTHING then
 * (handoff §2 honest states), never zeros standing in for a missing source.
 */
export function useGrowthWeek(weekStartIso: string): { data: GrowthWeek | null; isPending: boolean; isError: boolean } {
  const { data, isPending, isError } = useDualQuery<GrowthWeek | null>({
    queryKey: ['growthWeek', weekStartIso],
    mockData: growthWeekMock,
    realFetch: async () => {
      try {
        return await progressionApi.getGrowthWeek(weekStartIso)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }
    },
    realEmpty: null,
    realStaleTime: 60_000,
  })
  return { data: isError ? null : data, isPending, isError }
}
