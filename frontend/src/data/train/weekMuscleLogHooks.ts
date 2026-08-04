import { useQueries, useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useWeekWorkouts, weekWorkoutsQueryKey } from '@/data/train/workoutDetailHooks'
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
  // Track the summary query to know when the week is loaded. Must stay
  // `enabled: false` with no queryFn — useWeekWorkouts owns fetching this key;
  // this is a read-only observer into the shared cache entry.
  const summaryQuery = useQuery<WorkoutSummaryResponse[]>({
    queryKey: weekWorkoutsQueryKey().key,
    enabled: false,
  })
  const { workouts } = useWeekWorkouts()
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
    pending: !mock && (summaryQuery.isPending || queries.some((q) => q.isPending)),
  }
}
