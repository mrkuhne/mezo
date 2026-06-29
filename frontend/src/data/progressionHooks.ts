import { useDualQuery } from './useDualQuery'
import { progressionApi } from '@/lib/progressionApi'
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from './progressionMock'

/**
 * Athletic + muscle progression profile (radar, athlete-level, streak, highlights).
 * Dual-mode: a seeded fixture in mock mode, the real `GET /api/progression/profile`
 * in real mode; a 404 (progression switch off) or an empty backend surfaces as the
 * ghost profile (`athleteLevel === null`), which the profile cards ghost-guard on.
 */
export function useProgressionProfile() {
  return useDualQuery({
    queryKey: ['progressionProfile'],
    mockData: progressionProfileMock,
    realFetch: progressionApi.getProfile,
    realEmpty: GHOST_PROGRESSION_PROFILE,
    realStaleTime: 60_000,
  })
}
