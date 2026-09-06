import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { DietSettings } from '@/data/types'

type DietSettingsResponse = components['schemas']['DietSettingsResponse']
type SetDietSettingsRequest = components['schemas']['SetDietSettingsRequest']
type DietSettingsPreviewResponse = components['schemas']['DietSettingsPreviewResponse']

/** The projected day targets for an unsaved draft — the settings macro preview (mezo-u2pd). */
export interface DietTargetsPreview { kcal: number; p: number; c: number; f: number; source: 'goal' | 'config' }

const toWire = (settings: DietSettings): SetDietSettingsRequest => ({
  splitPreset: settings.splitPreset,
  proteinPctX10: settings.proteinPctX10 ?? undefined,
  carbsPctX10: settings.carbsPctX10 ?? undefined,
  fatPctX10: settings.fatPctX10 ?? undefined,
  proteinTier: settings.proteinTier,
  waterMl: settings.waterMl,
  fiberG: settings.fiberG,
  dayTypeShiftKcal: settings.dayTypeShiftKcal,
})

const fromWire = (r: DietSettingsResponse): DietSettings => ({
  splitPreset: r.splitPreset,
  proteinPctX10: r.proteinPctX10 ?? null,
  carbsPctX10: r.carbsPctX10 ?? null,
  fatPctX10: r.fatPctX10 ?? null,
  proteinTier: r.proteinTier,
  waterMl: r.waterMl,
  fiberG: r.fiberG,
  dayTypeShiftKcal: r.dayTypeShiftKcal,
})

export const dietSettingsApi = {
  get: (): Promise<DietSettings> =>
    apiFetch<DietSettingsResponse>('/api/diet/settings').then(fromWire),
  set: (settings: DietSettings): Promise<DietSettings> =>
    apiFetch<DietSettingsResponse>('/api/diet/settings', {
      method: 'PUT',
      body: JSON.stringify(toWire(settings)),
    }).then(fromWire),
  /** Read-only: what this draft WOULD prescribe today. Nothing is saved, no goal is re-evaluated. */
  preview: (draft: DietSettings): Promise<DietTargetsPreview> =>
    apiFetch<DietSettingsPreviewResponse>('/api/diet/settings/preview', {
      method: 'POST',
      body: JSON.stringify(toWire(draft)),
    }).then((r) => ({ kcal: r.kcal, p: r.proteinG, c: r.carbsG, f: r.fatG, source: r.source })),
}
