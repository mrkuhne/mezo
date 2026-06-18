import { apiFetch } from './api'
import type { components } from './api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type BiometricProfileResponse = components['schemas']['BiometricProfileResponse']
export type BiometricProfileUpsertRequest = components['schemas']['BiometricProfileUpsertRequest']

export const biometricProfileApi = {
  get: (): Promise<BiometricProfileResponse> =>
    apiFetch<BiometricProfileResponse>('/api/biometrics/profile'),
  upsert: (body: BiometricProfileUpsertRequest): Promise<BiometricProfileResponse> =>
    apiFetch<BiometricProfileResponse>('/api/biometrics/profile', {
      method: 'PUT',
      body: JSON.stringify(body satisfies BiometricProfileUpsertRequest),
    }),
}
