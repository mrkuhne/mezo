import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  biometricProfileApi,
  type BiometricProfileResponse,
  type BiometricProfileUpsertRequest,
} from '@/lib/biometricProfileApi'
import { ApiError } from '@/lib/api'
import { isMockMode } from '@/lib/mode'
import { biometricProfile as mockBiometricProfile } from './goals'

// Biometric profile read (G6, mezo-06n). The profile is a first-class Profile
// card + the precondition for goal creation (the Task-7 hard gate). Real mode
// queries ['biometricProfile'] → biometricProfileApi.get(); the endpoint 404s
// when no profile exists yet, which is a normal "not set up" state (NOT an
// error), so we catch the 404 and resolve to null. Any other status rethrows.
// Mock mode returns a static complete profile so the card renders offline.
// `isComplete` is the gate predicate: the three required fields are present.
export function useBiometricProfile(): {
  profile: BiometricProfileResponse | null
  isComplete: boolean
  isLoading: boolean
} {
  const mock = isMockMode()
  const { data, isLoading } = useQuery({
    queryKey: ['biometricProfile'],
    queryFn: mock
      ? async () => mockBiometricProfile
      : async (): Promise<BiometricProfileResponse | null> => {
          try {
            return await biometricProfileApi.get()
          } catch (err) {
            // 404 = no profile yet → treat as "not set up", not an error.
            if (err instanceof ApiError && err.status === 404) return null
            throw err
          }
        },
    initialData: mock ? mockBiometricProfile : undefined,
  })
  const profile = data ?? null
  const isComplete = !!(profile && profile.sex && profile.heightCm && profile.birthDate)
  return { profile, isComplete, isLoading }
}

// Biometric profile write (G6, mezo-06n). Real mode PUTs the profile then
// invalidates ['biometricProfile'] (the card/gate re-read the fresh value) and
// ['goals'] (the backend recomputes the active goal's tdeeBootstrap/prescription
// on profile change — Task 3). Mock mode no-ops and resolves so the editor sheet
// can fire-and-forget in Phase-1 parity. Returns the mutation promise so the
// sheet can `.then(close)` on success.
export function useBiometricActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (body: BiometricProfileUpsertRequest): Promise<BiometricProfileResponse | null> => {
      if (mock) return null
      return biometricProfileApi.upsert(body)
    },
    onSuccess: () => {
      if (!mock) {
        qc.invalidateQueries({ queryKey: ['biometricProfile'] })
        qc.invalidateQueries({ queryKey: ['goals'] })
      }
    },
  })
  const upsert = useCallback(
    (body: BiometricProfileUpsertRequest) => mutation.mutateAsync(body),
    [mutation],
  )
  return { upsert, pending: mutation.isPending }
}
