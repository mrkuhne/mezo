import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import { tutorialProgressApi } from '@/data/tutorial/tutorialProgressApi'
import type { TutorialProgress } from '@/data/types'

/** The backend's empty-map ghost — the honest value in BOTH modes before the first guide is seen. */
export const TUTORIAL_PROGRESS_GHOST: TutorialProgress = {}

const KEY = ['tutorialProgress'] as const

export function useTutorialProgress() {
  const { data, isPending, isError } = useDualQuery<TutorialProgress>({
    queryKey: KEY,
    mockData: TUTORIAL_PROGRESS_GHOST,
    realFetch: tutorialProgressApi.get,
    realEmpty: TUTORIAL_PROGRESS_GHOST,
    // Mounts in the shell (TutorialProvider) — without this the read would be always-stale (mezo-5cmq).
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { progress: data, isPending, isError }
}

export function useTutorialProgressActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const set = useMutation({
    mutationFn: async (progress: TutorialProgress) => {
      if (mock) { qc.setQueryData<TutorialProgress>(KEY, progress); return }
      const saved = await tutorialProgressApi.set(progress)
      qc.setQueryData<TutorialProgress>(KEY, saved)
    },
  })
  const reset = useMutation({
    mutationFn: async () => {
      if (mock) { qc.setQueryData<TutorialProgress>(KEY, {}); return }
      // A DELETE hibája SZÁNDÉKOSAN kiszáll (mezo-gb1s.2): elnyelve a lokális kiürül, majd a
      // TutorialProvider szerver-merge effektje a szerver régi állapotát visszahozza — a reset
      // látszólag sikerül, aztán némán visszafordul.
      // A cancelQueries a repülő GET ellen véd: egy a DELETE ELŐTT indult válasz különben a
      // törlés UTÁN írná be a régi mapet a cache-be.
      await qc.cancelQueries({ queryKey: KEY })
      await tutorialProgressApi.reset()
      qc.setQueryData<TutorialProgress>(KEY, {})
    },
  })
  return {
    setProgress: (p: TutorialProgress) => set.mutateAsync(p).then(() => undefined),
    resetProgress: () => reset.mutateAsync().then(() => undefined),
  }
}
