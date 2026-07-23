import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { fuelSettingsApi } from '@/data/fuel/fuelSettingsApi'
import type { FuelSettings } from '@/data/types'

/** The backend's config-default ghost — the honest value in BOTH modes before a save. */
export const FUEL_SETTINGS_GHOST: FuelSettings = { mealsPerDay: 4, caffeineCutoff: '14:00' }

export function useFuelSettings() {
  const { data, isPending } = useDualQuery<FuelSettings>({
    queryKey: ['fuelSettings'],
    mockData: FUEL_SETTINGS_GHOST,
    realFetch: fuelSettingsApi.get,
    realEmpty: FUEL_SETTINGS_GHOST,
  })
  return { settings: data, isPending }
}

export function useFuelSettingsActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (settings: FuelSettings) => {
      if (mock) {
        qc.setQueryData<FuelSettings>(['fuelSettings'], settings)
        return
      }
      await fuelSettingsApi.set(settings)
    },
    onSuccess: mock ? undefined : () => {
      qc.invalidateQueries({ queryKey: ['fuelSettings'] })
      qc.invalidateQueries({ queryKey: ['habitDay'] }) // no_stim_after re-centers on the new cutoff
    },
  })
  return {
    setSettings: (s: FuelSettings) => mutation.mutateAsync(s).then(() => undefined),
    pending: mutation.isPending,
  }
}
