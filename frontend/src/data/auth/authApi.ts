import { apiFetch, setToken } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

export type LoginRequest = components['schemas']['LoginRequest']
export type RegisterRequest = components['schemas']['RegisterRequest']
export type ChangePasswordRequest = components['schemas']['ChangePasswordRequest']
export type MeResponse = components['schemas']['MeResponse']
type TokenResponse = components['schemas']['TokenResponse']

export const authApi = {
  login: async (body: LoginRequest): Promise<void> => {
    const { token } = await apiFetch<TokenResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) })
    setToken(token)
  },
  register: async (body: RegisterRequest): Promise<void> => {
    const { token } = await apiFetch<TokenResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) })
    setToken(token)
  },
  me: (): Promise<MeResponse> => apiFetch<MeResponse>('/api/auth/me'),
  changePassword: (body: ChangePasswordRequest): Promise<void> =>
    apiFetch<void>('/api/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  completeOnboarding: (): Promise<void> =>
    apiFetch<void>('/api/auth/onboarding-complete', { method: 'POST' }),
}
