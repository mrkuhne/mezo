import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { authApi } from '@/data/auth/authApi'
import { ME_QUERY_KEY } from '@/data/auth/authHooks'
import { biometricProfileApi } from '@/data/me/biometricProfileApi'
import { weightApi } from '@/data/me/biometricsApi'
import { localDateString } from '@/shared/lib/dates'

/** What the OnboardingPage collects — exactly the NOT NULL trio of the biometric profile + today's weigh-in. */
export interface OnboardingInput {
  sex: 'M' | 'F'
  heightCm: number
  birthDate: string // YYYY-MM-DD
  weightKg: number
}

/**
 * The onboarding commit (S2, mezo-qw37.2): PUT /api/biometrics/profile → POST /api/biometrics/weight
 * (today) → POST /api/auth/onboarding-complete, in that order, then invalidate everything the three
 * writes touch. No new contract: the wizard reuses the biometrics + weight endpoints verbatim.
 * `activityLevel: 'MIXED'` is sent EXPLICITLY — the column is nullable and the server does not
 * default it; a null is only *interpreted* as MIXED downstream (GoalEngineProperties.Neat.forLevel),
 * so an omitted value would leave the profile screen showing no activity level at all.
 * A retry after a partial failure re-runs all three — the profile PUT is an upsert, the flag is
 * idempotent, and a second same-day weigh-in row only nudges the EWMA trend.
 * Mock mode resolves without network (the static seeds already describe an onboarded owner).
 */
export function useOnboardingActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const [pending, setPending] = useState(false)

  const complete = useCallback(async (input: OnboardingInput): Promise<void> => {
    if (mock) return
    setPending(true)
    try {
      await biometricProfileApi.upsert({
        sex: input.sex, heightCm: input.heightCm, birthDate: input.birthDate, activityLevel: 'MIXED',
      })
      await weightApi.log({ date: localDateString(), weightKg: input.weightKg })
      await authApi.completeOnboarding()
      await Promise.all([
        qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: ['biometricProfile'] }),
        qc.invalidateQueries({ queryKey: ['weightLog'] }),
        qc.invalidateQueries({ queryKey: ['weightTrend'] }),
        qc.invalidateQueries({ queryKey: ['goals'] }),
      ])
    } finally {
      setPending(false)
    }
  }, [mock, qc])

  return { complete, pending }
}
