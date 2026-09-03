import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { dietSettingsApi } from '@/data/fuel/dietSettingsApi'
import type { DietSettings } from '@/data/types'

/** The backend's config-default ghost — the honest value in BOTH modes before a save. */
export const DIET_SETTINGS_GHOST: DietSettings = {
  splitPreset: 'balanced', proteinPctX10: null, carbsPctX10: null, fatPctX10: null,
  proteinTier: 'moderate', waterMl: 4000, fiberG: 30, dayTypeShiftKcal: 0,
}

export function useDietSettings() {
  const { data, isPending } = useDualQuery<DietSettings>({
    queryKey: ['dietSettings'],
    mockData: DIET_SETTINGS_GHOST,
    realFetch: dietSettingsApi.get,
    realEmpty: DIET_SETTINGS_GHOST,
  })
  return { settings: data, isPending }
}

export function useDietSettingsActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (settings: DietSettings) => {
      if (mock) {
        qc.setQueryData<DietSettings>(['dietSettings'], settings)
        return
      }
      await dietSettingsApi.set(settings)
    },
    onSuccess: mock ? undefined : () => {
      qc.invalidateQueries({ queryKey: ['dietSettings'] })
      qc.invalidateQueries({ queryKey: ['goals'] })    // save re-prescribed the active goal (carbsG/fatG)
      qc.invalidateQueries({ queryKey: ['fuelDay'] })  // day targets changed with the split
    },
  })
  return {
    setSettings: (s: DietSettings) => mutation.mutateAsync(s).then(() => undefined),
    pending: mutation.isPending,
  }
}
