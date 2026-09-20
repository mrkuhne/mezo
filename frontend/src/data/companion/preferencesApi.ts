import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
export type CompanionPreferences = components['schemas']['CompanionPreferencesResponse']
export type PersonalContext = components['schemas']['CompanionPersonalContextResponse']
export type AccountUpdate = components['schemas']['UpdateAccountRequest']
export const preferencesApi = {
  get: () => apiFetch<CompanionPreferences>('/api/companion/preferences'),
  save: (body: components['schemas']['CompanionPreferencesRequest']) => apiFetch<CompanionPreferences>('/api/companion/preferences', { method: 'PUT', body: JSON.stringify(body) }),
  context: () => apiFetch<PersonalContext>('/api/companion/personal-context'),
  account: (body: AccountUpdate) => apiFetch<components['schemas']['MeResponse']>('/api/auth/me', { method: 'PUT', body: JSON.stringify(body) }),
}
