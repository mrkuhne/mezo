import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { trainApi, type WorkoutDetailResponse, type WorkoutSummaryResponse } from '@/data/train/trainApi'
import { workoutChainMock, workoutDetailMock, workoutDetailsMock } from '@/data/train/train'

/**
 * One workout instance for the done-day review screen. Mock mode serves a static
 * fixture synchronously (via initialData) regardless of `id` — documented offline
 * browsing behavior. Real mode fetches by id and has no static fallback (T0).
 */
const mockDetail = (id: string | null): WorkoutDetailResponse =>
  (id && workoutDetailsMock[id]) || workoutDetailMock

export function useWorkoutDetail(id: string | null) {
  const mock = isMockMode()
  const q = useQuery<WorkoutDetailResponse>({
    queryKey: ['train', 'workoutDetail', id],
    // Mock mode answers by id for the seeded template-day chain (mezo-d20.8.2.1); any other id
    // still resolves to the one review fixture, which is the documented offline browsing
    // behavior. Without the lookup the comparison would run against ITSELF and read ±0 on every
    // cell — a confident wrong answer, which is worse than no answer.
    queryFn: mock ? async () => mockDetail(id) : () => trainApi.getWorkout(id as string),
    enabled: mock || !!id,
    initialData: mock ? mockDetail(id) : undefined,
    retry: false,
  })
  return { detail: q.data ?? null, pending: !mock && q.isPending, error: !mock && q.isError }
}

/**
 * Mon-anchored query key for this week's workout summaries — single source of
 * truth for both `useWeekWorkouts` and `useWeekMuscleLog`'s pending observer
 * (mezo-oyhy.7). Keeps the Monday derivation and key shape from silently
 * desyncing between the two call sites.
 */
export function weekWorkoutsQueryKey(): { key: readonly [string, string, string]; monday: string; sunday: string } {
  const now = new Date()
  const mondayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const monday = localDateString(mondayDate)
  const sunday = localDateString(new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 6))
  return { key: ['train', 'weekWorkouts', monday], monday, sunday }
}

/**
 * This Mon–Sun week's workout summaries — maps weekly-row dates to instance ids.
 * Mock mode has no persisted instances, so it serves an empty week; real mode
 * fetches the current week's range via `trainApi.listWorkouts`.
 */
export function useWeekWorkouts() {
  const mock = isMockMode()
  const { key, monday, sunday } = weekWorkoutsQueryKey()
  const q = useQuery<WorkoutSummaryResponse[]>({
    queryKey: key,
    queryFn: mock ? async () => [] : () => trainApi.listWorkouts(monday, sunday),
    initialData: mock ? [] : undefined,
  })
  return { workouts: q.data ?? [] }
}

/** How far back the template-day chain is searched. Half a year covers any realistic mesocycle
 *  plus a skipped block; past that, "the previous same day" stops being a useful reference. */
const CHAIN_WINDOW_DAYS = 183

export interface TemplateDayChain {
  /** Completed instances of the same template day, date-ascending, including this one. */
  chain: WorkoutSummaryResponse[]
  /** Neighbours on that chain — the axis the review's comparison AND stepping both use, so
   *  there is one mental model rather than two (spec 2026-08-31 §3.4). */
  prev: WorkoutSummaryResponse | null
  next: WorkoutSummaryResponse | null
}

const EMPTY_CHAIN: TemplateDayChain = { chain: [], prev: null, next: null }

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return localDateString(d)
}

/**
 * The completed instances of one template day around `date`.
 *
 * A custom workout has no `templateSessionId` and therefore no chain — the hook returns empty,
 * and the review page renders neither the comparison tile nor the stepping. That is the honest
 * answer, not a degraded one: there is nothing this workout is a repetition of.
 */
export function useTemplateDayChain(templateSessionId: string | null | undefined, date: string | null): TemplateDayChain {
  const mock = isMockMode()
  const from = date ? shiftDate(date, -CHAIN_WINDOW_DAYS) : ''
  const to = date ? shiftDate(date, CHAIN_WINDOW_DAYS) : ''
  const q = useQuery<WorkoutSummaryResponse[]>({
    queryKey: ['train', 'templateDayChain', templateSessionId ?? null, date],
    queryFn: mock ? async () => workoutChainMock : () => trainApi.listWorkouts(from, to),
    enabled: mock || (!!templateSessionId && !!date),
    initialData: mock ? workoutChainMock : undefined,
  })

  if (!templateSessionId || !date) return EMPTY_CHAIN
  const chain = (q.data ?? [])
    .filter((w) => w.templateSessionId === templateSessionId && w.status === 'completed')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  const here = chain.findIndex((w) => w.date === date)
  if (here < 0) return { chain, prev: null, next: null }
  return {
    chain,
    prev: here > 0 ? chain[here - 1] : null,
    next: here < chain.length - 1 ? chain[here + 1] : null,
  }
}
