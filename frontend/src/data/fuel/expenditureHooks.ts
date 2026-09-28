import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery, DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import {
  expenditureApi,
  type ExpenditureExplanation, type ExpenditureHistory, type ExpenditureWeeklyCard,
  type IntakeDayMarkResult, type IntakeDayStatus,
} from '@/data/fuel/expenditureApi'
import { expenditureExplanationSeed } from '@/data/fuel/expenditureExplanation'
import {
  DEFAULT_APPLIED_BASE_KCAL, expenditureHistorySeed, expenditureWeeklyCardSeed, intakeDaysSeed,
  todayIso,
} from '@/data/fuel/expenditureLearningSeed'

export const EXPENDITURE_EXPLANATION_KEY = ['expenditureExplanation'] as const
export const EXPENDITURE_HISTORY_KEY = ['expenditureHistory'] as const
export const EXPENDITURE_WEEKLY_CARD_KEY = ['expenditureWeeklyCard'] as const
const INTAKE_DAYS_PREFIX = ['intakeDays'] as const
const intakeDaysKey = (from: string, to: string) => [...INTAKE_DAYS_PREFIX, from, to] as const
const EMPTY_DAYS: IntakeDayStatus[] = []
/** Mock-only scratch key — never read by a public hook, only by the mark/clear mutation below to
 *  track the "before" applied base across successive marks within one QueryClient. */
const MOCK_APPLIED_BASE_KEY = ['__mockExpenditureAppliedBase'] as const

/**
 * „Hogy tanultam?” (mezo-y72o3): the learned base's persisted explanation. Mock seeds the
 * prototype fixture; real fetches `GET /api/goals/expenditure/explanation` only while `enabled`
 * (the explainer opens lazily). `data === null` + `!isPending` = no explained week yet (204).
 */
export function useExpenditureExplanation(enabled: boolean): {
  data: ExpenditureExplanation | null
  isPending: boolean
  isError: boolean
} {
  const { data, isPending, isError } = useDualQuery<ExpenditureExplanation | null>({
    queryKey: EXPENDITURE_EXPLANATION_KEY,
    mockData: expenditureExplanationSeed,
    realFetch: expenditureApi.explanation,
    realEmpty: null,
    enabled,
  })
  return { data, isPending: data === null && isPending, isError }
}

/**
 * The caller's last N reviewed weeks, oldest first, plus the learning switch (mezo-3n2so, spec
 * §6.3) — the "Hétről hétre" chart on the „Hogy tanultam?” page. `data === null` while a
 * real-mode read is unresolved.
 */
export function useExpenditureHistory(): {
  data: ExpenditureHistory | null
  isPending: boolean
  isError: boolean
} {
  const { data, isPending, isError } = useDualQuery<ExpenditureHistory | null>({
    queryKey: EXPENDITURE_HISTORY_KEY,
    mockData: expenditureHistorySeed(),
    realFetch: expenditureApi.history,
    realEmpty: null,
  })
  return { data, isPending: data === null && isPending, isError }
}

/**
 * The current weekly-summary card (mezo-3n2so, spec §5.1) — shown only when it says something.
 * `card === null` covers "nothing worth showing" (204), an unresolved real-mode read, AND a
 * dismissed mock card; `isPending` disambiguates the middle one.
 *
 * This deliberately does NOT go through `useDualQuery`: that helper's mock branch always falls
 * back to the seed whenever the cache reads `undefined` OR `null` (`q.data ?? opts.mockData`),
 * so a mock dismiss writing `null` into the cache would be silently overridden back to the seed
 * card. Distinguishing "never fetched" (`undefined`) from "explicitly empty" (`null`) needs the
 * raw query below instead.
 */
export function useExpenditureWeeklyCard(): { card: ExpenditureWeeklyCard | null; isPending: boolean } {
  const mock = isMockMode()
  const q = useQuery({
    queryKey: EXPENDITURE_WEEKLY_CARD_KEY,
    queryFn: mock ? async () => expenditureWeeklyCardSeed() : expenditureApi.weeklyCard,
    initialData: mock ? expenditureWeeklyCardSeed() : undefined,
    staleTime: mock ? Infinity : DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { card: q.data ?? null, isPending: q.isPending }
}

/** Live per-day statuses for a range — never past today (mezo-3n2so, spec §6.3/§7). */
export function useIntakeDays(from: string, to: string): { days: IntakeDayStatus[]; isPending: boolean } {
  const { data, isPending } = useDualQuery<IntakeDayStatus[]>({
    queryKey: intakeDaysKey(from, to),
    mockData: intakeDaysSeed().filter((d) => d.date >= from && d.date <= to),
    realFetch: () => expenditureApi.days(from, to),
    realEmpty: EMPTY_DAYS,
  })
  return { days: data, isPending }
}

/** Every currently-cached `['intakeDays', from, to]` query's data, across every mounted range. */
function findCachedDay(qc: QueryClient, date: string): IntakeDayStatus | undefined {
  for (const query of qc.getQueryCache().findAll({ queryKey: INTAKE_DAYS_PREFIX })) {
    const found = (query.state.data as IntakeDayStatus[] | undefined)?.find((d) => d.date === date)
    if (found) return found
  }
  return intakeDaysSeed().find((d) => d.date === date)
}

function writeCachedDay(qc: QueryClient, next: IntakeDayStatus): void {
  for (const query of qc.getQueryCache().findAll({ queryKey: INTAKE_DAYS_PREFIX })) {
    qc.setQueryData<IntakeDayStatus[]>(query.queryKey, (days) =>
      days?.map((d) => (d.date === next.date ? next : d)))
  }
}

/**
 * Mock mark/clear (mezo-3n2so): a deterministic stand-in for the real re-chain. COMPLETE on a
 * suspicious day pulls the applied base down 40 kcal (a previously-excluded low day now counts);
 * INCOMPLETE on a usable day pushes it up 40 kcal (a previously-counted day is dropped); CLEAR
 * reverses whichever of those the day currently carries. TODAY never recomputes — the mark is
 * saved, but the base only moves at next Monday's run (`recomputed: false`, before === after).
 */
function mockMark(
  qc: QueryClient,
  date: string,
  action: { kind: 'set'; status: 'complete' | 'incomplete' } | { kind: 'clear' },
): IntakeDayMarkResult {
  const current = findCachedDay(qc, date)
  if (!current || current.status === 'unlogged') {
    throw new Error(`No logged intake on ${date}`)
  }
  const before = qc.getQueryData<number>(MOCK_APPLIED_BASE_KEY) ?? DEFAULT_APPLIED_BASE_KCAL
  const isToday = date === todayIso()

  let nextStatus: IntakeDayStatus['status'] = current.status
  let nextMark: IntakeDayStatus['mark'] = current.mark ?? null
  let delta = 0

  if (action.kind === 'set' && action.status === 'complete') {
    delta = current.status === 'suspicious' ? -40 : 0
    nextStatus = 'confirmed_complete'
    nextMark = 'complete'
  } else if (action.kind === 'set') {
    delta = current.status === 'usable' ? 40 : 0
    nextStatus = 'marked_incomplete'
    nextMark = 'incomplete'
  } else if (current.status === 'confirmed_complete') {
    delta = 40
    nextStatus = 'suspicious'
    nextMark = null
  } else if (current.status === 'marked_incomplete') {
    delta = -40
    nextStatus = 'usable'
    nextMark = null
  }

  const after = isToday ? before : before + delta
  const day: IntakeDayStatus = { ...current, status: nextStatus, mark: nextMark }
  writeCachedDay(qc, day)
  qc.setQueryData(MOCK_APPLIED_BASE_KEY, after)
  return { day, appliedBaseBeforeKcal: before, appliedBaseAfterKcal: after, recomputed: !isToday }
}

/**
 * Mark/clear a logged, non-future day complete/incomplete — re-chains the learned base from
 * that week on (mezo-3n2so, spec §7). Real mode invalidates every read the re-chain can move:
 * the day's Fuel targets, the active goal, and every learned-expenditure surface.
 */
export function useIntakeDayMark(): {
  setMark: (date: string, status: 'complete' | 'incomplete') => Promise<IntakeDayMarkResult>
  clearMark: (date: string) => Promise<IntakeDayMarkResult>
  pending: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()

  const mutation = useMutation({
    mutationFn: async (
      input: { date: string } & (
        | { kind: 'set'; status: 'complete' | 'incomplete' }
        | { kind: 'clear' }
      ),
    ): Promise<IntakeDayMarkResult> => {
      if (mock) return mockMark(qc, input.date, input)
      return input.kind === 'set'
        ? expenditureApi.setMark(input.date, input.status)
        : expenditureApi.clearMark(input.date)
    },
    onSuccess: mock ? undefined : () => {
      qc.invalidateQueries({ queryKey: ['fuelDay'] })
      qc.invalidateQueries({ queryKey: ['goals'] })
      qc.invalidateQueries({ queryKey: EXPENDITURE_EXPLANATION_KEY })
      qc.invalidateQueries({ queryKey: EXPENDITURE_HISTORY_KEY })
      qc.invalidateQueries({ queryKey: EXPENDITURE_WEEKLY_CARD_KEY })
      qc.invalidateQueries({ queryKey: INTAKE_DAYS_PREFIX })
    },
  })

  return {
    setMark: (date, status) => mutation.mutateAsync({ date, kind: 'set', status }),
    clearMark: (date) => mutation.mutateAsync({ date, kind: 'clear' }),
    pending: mutation.isPending,
  }
}

/** Dismiss the weekly-summary card for one reviewed week — cross-device, per week (mezo-3n2so). */
export function useDismissWeeklyCard(): { dismiss: (weekStart: string) => Promise<void> } {
  const qc = useQueryClient()
  const mock = isMockMode()

  const mutation = useMutation({
    mutationFn: async (weekStart: string) => {
      if (mock) {
        qc.setQueryData<ExpenditureWeeklyCard | null>(EXPENDITURE_WEEKLY_CARD_KEY, null)
        return
      }
      await expenditureApi.dismissWeeklyCard(weekStart)
    },
    onSuccess: mock ? undefined : () => {
      qc.invalidateQueries({ queryKey: EXPENDITURE_WEEKLY_CARD_KEY })
    },
  })

  return { dismiss: (weekStart) => mutation.mutateAsync(weekStart) }
}
