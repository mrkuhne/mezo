import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { FuelSettings } from '@/data/types'

type FuelSettingsResponse = components['schemas']['FuelSettingsResponse']
type SetFuelSettingsRequest = components['schemas']['SetFuelSettingsRequest']

export const fuelSettingsApi = {
  get: (): Promise<FuelSettings> => apiFetch<FuelSettingsResponse>('/api/fuel/settings'),
  set: (settings: FuelSettings): Promise<FuelSettings> =>
    apiFetch<FuelSettingsResponse>('/api/fuel/settings', {
      method: 'PUT',
      body: JSON.stringify({
        mealsPerDay: settings.mealsPerDay,
        caffeineCutoff: settings.caffeineCutoff,
      } satisfies SetFuelSettingsRequest),
    }),
}
