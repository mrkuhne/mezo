import { ApiError } from '@/data/_client/api'
import { levelFromTotalXp } from '@/data/gamification/levelCurve'
import { GHOST_GAMIFICATION } from '@/data/gamification/gamificationMock'
import type { GamificationProfile } from '@/data/gamification/gamificationTypes'
import { progressionApi, type ProgressionProfileResponse } from '@/data/progression/progressionApi'

/** Real-mode interim (spec §8, until mezo-huzd): account XP/level derived from the real
 *  progression profile (Σ cumulativeXp over every skill); coins/streak/titles stay ghost.
 *  Mirrors the sanctioned useProfile static exception (mezo-lfw): documented, temporary. */
export async function fetchDerivedGamification(): Promise<GamificationProfile> {
  let p: ProgressionProfileResponse
  try {
    p = await progressionApi.getProfile()
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return GHOST_GAMIFICATION
    throw err
  }
  const totalXp = [...p.athletic, ...p.muscle, ...p.life].reduce((s, x) => s + x.cumulativeXp, 0)
  const { level, xpInLevel, xpForNext } = levelFromTotalXp(totalXp)
  return { ...GHOST_GAMIFICATION, level, totalXp, xpInLevel, xpForNext }
}
