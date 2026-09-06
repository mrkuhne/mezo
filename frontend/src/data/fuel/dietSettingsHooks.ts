import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { dietSettingsApi, type DietTargetsPreview } from '@/data/fuel/dietSettingsApi'
import { projectDraftTargets } from '@/features/fuel/logic/fuelSettingsPreview'
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

/**
 * The macro targets an UNSAVED diet draft would prescribe today (mezo-u2pd) — what the Fuel
 * settings preview shows while the user flips Makróprofil / protein tier / edzőnap-shift, before
 * Mentés. Until one of those actually moves, this is the served target verbatim: no projection, no
 * round-trip, so opening the screen shows exactly what the Fuel day shows.
 *
 * Once it moves, real mode POSTs the draft to `/api/diet/settings/preview`, which runs the actual
 * goal engine read-only — the previewed numbers ARE the ones the save will produce. Mock mode has
 * no engine, so it re-derives them locally (see `projectDraftTargets` for the two documented mock
 * fictions). `keepPreviousRealData` holds the last projection on screen while a new draft
 * resolves, so the numbers never blank out mid-flip.
 *
 * @param draft the in-progress settings
 * @param saved the persisted settings `base` was prescribed under
 * @param base  the currently served day targets
 */
export function useDietSettingsPreview(
  draft: DietSettings,
  saved: DietSettings,
  base: { kcal: number; p: number; c: number; f: number },
) {
  // Only these four inputs move the engine's macro numbers; water/fiber/the advisory protein and
  // carb percents never do, so they must not trigger a projection or a fetch.
  const macroDirty = draft.splitPreset !== saved.splitPreset
    || draft.fatPctX10 !== saved.fatPctX10
    || draft.proteinTier !== saved.proteinTier
    || draft.dayTypeShiftKcal !== saved.dayTypeShiftKcal
  const served: DietTargetsPreview = { ...base, source: 'goal' }
  const { data, isPending } = useDualQuery<DietTargetsPreview>({
    queryKey: ['dietSettingsPreview', draft.splitPreset, draft.fatPctX10, draft.proteinTier,
      draft.dayTypeShiftKcal],
    mockData: macroDirty
      ? { ...projectDraftTargets(base, draft, saved.proteinTier), source: 'goal' }
      : served,
    realFetch: () => dietSettingsApi.preview(draft),
    realEmpty: served,
    keepPreviousRealData: true,
    enabled: macroDirty,
  })
  return { preview: data, isPending }
}
