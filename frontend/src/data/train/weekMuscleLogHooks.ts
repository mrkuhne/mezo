import { useQueries } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useWeekWorkouts } from '@/data/train/workoutDetailHooks'
import { trainApi, type WorkoutDetailResponse, type WorkoutSummaryResponse } from '@/data/train/trainApi'

/**
 * This week's completed workout instances WITH full per-set detail — the live
 * data source of the zone bars (mezo-oyhy.7). Composes useWeekWorkouts (summaries)
 * with one detail query per completed instance (meso AND custom origins); the
 * query keys match useWorkoutDetail so the review screens share the cache.
 * Mock mode has no persisted instances → empty, pending false (documented).
 * Conscious v1: client-side aggregation over ≤7 cached fetches, no backend
 * aggregate endpoint until this measurably hurts.
 */
export function useWeekMuscleLog(): {
  details: WorkoutDetailResponse[]
  completedSummaries: WorkoutSummaryResponse[]
  pending: boolean
} {
  const mock = isMockMode()
  // The week's summaries come from ONE observer, useWeekWorkouts, which owns the key AND its queryFn.
  // A second read-only observer without a queryFn (the old pending probe) made every refetch of the
  // shared key log "No queryFn was passed" (mezo-fp5s4): a refetch runs with the options of whichever
  // observer set them last.
  const { workouts, isPending: summaryPending } = useWeekWorkouts()
  const completedSummaries = workouts.filter((w) => w.status === 'completed')
  const queries = useQueries({
    queries: completedSummaries.map((w) => ({
      queryKey: ['train', 'workoutDetail', w.id],
      queryFn: () => trainApi.getWorkout(w.id),
      enabled: !mock,
      retry: false,
    })),
  })
  return {
    details: queries.map((q) => q.data).filter((d): d is WorkoutDetailResponse => d !== undefined),
    completedSummaries,
    pending: !mock && (summaryPending || queries.some((q) => q.isPending)),
  }
}
