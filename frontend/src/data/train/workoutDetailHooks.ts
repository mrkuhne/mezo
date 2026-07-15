import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { trainApi, type WorkoutDetailResponse, type WorkoutSummaryResponse } from '@/data/train/trainApi'
import { workoutDetailMock } from '@/data/train/train'

/**
 * One workout instance for the done-day review screen. Mock mode serves a static
 * fixture synchronously (via initialData) regardless of `id` — documented offline
 * browsing behavior. Real mode fetches by id and has no static fallback (T0).
 */
export function useWorkoutDetail(id: string | null) {
  const mock = isMockMode()
  const q = useQuery<WorkoutDetailResponse>({
    queryKey: ['train', 'workoutDetail', id],
    queryFn: mock ? async () => workoutDetailMock : () => trainApi.getWorkout(id as string),
    enabled: mock || !!id,
    initialData: mock ? workoutDetailMock : undefined,
    retry: false,
  })
  return { detail: q.data ?? null, pending: !mock && q.isPending, error: !mock && q.isError }
}

/**
 * This Mon–Sun week's workout summaries — maps weekly-row dates to instance ids.
 * Mock mode has no persisted instances, so it serves an empty week; real mode
 * fetches the current week's range via `trainApi.listWorkouts`.
 */
export function useWeekWorkouts() {
  const mock = isMockMode()
  const now = new Date()
  const mondayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const monday = localDateString(mondayDate)
  const sunday = localDateString(new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 6))
  const q = useQuery<WorkoutSummaryResponse[]>({
    queryKey: ['train', 'weekWorkouts', monday],
    queryFn: mock ? async () => [] : () => trainApi.listWorkouts(monday, sunday),
    initialData: mock ? [] : undefined,
  })
  return { workouts: q.data ?? [] }
}
