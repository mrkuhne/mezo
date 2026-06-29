import { useDualQuery } from './useDualQuery'
import { progressionApi } from '@/lib/progressionApi'
import { ApiError } from '@/lib/api'
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from './progressionMock'

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
