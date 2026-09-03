import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { DietSettings } from '@/data/types'

type DietSettingsResponse = components['schemas']['DietSettingsResponse']
type SetDietSettingsRequest = components['schemas']['SetDietSettingsRequest']

const fromWire = (r: DietSettingsResponse): DietSettings => ({
  splitPreset: r.splitPreset,
  proteinPctX10: r.proteinPctX10 ?? null,
  carbsPctX10: r.carbsPctX10 ?? null,
  fatPctX10: r.fatPctX10 ?? null,
  proteinTier: r.proteinTier,
  waterMl: r.waterMl,
  fiberG: r.fiberG,
})

export const dietSettingsApi = {
  get: (): Promise<DietSettings> =>
    apiFetch<DietSettingsResponse>('/api/diet/settings').then(fromWire),
  set: (settings: DietSettings): Promise<DietSettings> =>
    apiFetch<DietSettingsResponse>('/api/diet/settings', {
      method: 'PUT',
      body: JSON.stringify({
        splitPreset: settings.splitPreset,
        proteinPctX10: settings.proteinPctX10 ?? undefined,
        carbsPctX10: settings.carbsPctX10 ?? undefined,
        fatPctX10: settings.fatPctX10 ?? undefined,
        proteinTier: settings.proteinTier,
        waterMl: settings.waterMl,
        fiberG: settings.fiberG,
      } satisfies SetDietSettingsRequest),
    }).then(fromWire),
}
