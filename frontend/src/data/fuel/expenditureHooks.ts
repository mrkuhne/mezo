import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery, DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import {
  expenditureApi,
  type ExpenditureExplanation, type ExpenditureHistory, type ExpenditureWeeklyCard,
  type IntakeDayMarkResult, type IntakeDayStatus,
} from '@/data/fuel/expenditureApi'
import { expenditureExplanationSeed } from '@/data/fuel/expenditureExplanation'
import {
  applyMockDayMark, dismissMockWeeklyCard, expenditureHistorySeed, expenditureWeeklyCardSeed,
  intakeDaysSeed, type MockIntakeDayMarkAction,
} from '@/data/fuel/expenditureLearningSeed'

export const EXPENDITURE_EXPLANATION_KEY = ['expenditureExplanation'] as const
export const EXPENDITURE_HISTORY_KEY = ['expenditureHistory'] as const
export const EXPENDITURE_WEEKLY_CARD_KEY = ['expenditureWeeklyCard'] as const
const INTAKE_DAYS_PREFIX = ['intakeDays'] as const
const intakeDaysKey = (from: string, to: string) => [...INTAKE_DAYS_PREFIX, from, to] as const
const EMPTY_DAYS: IntakeDayStatus[] = []

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
 * raw query below instead. `expenditureWeeklyCardSeed` itself reads the canonical
 * `mockState.weeklyCardDismissed` (see expenditureLearningSeed.ts), so a remount after dismiss —
 * even with a brand-new QueryClient — still starts `null`.
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

/**
 * Live per-day statuses for a range — never past today (mezo-3n2so, spec §6.3/§7). Mock mode
 * always reads `intakeDaysSeed(from, to)` fresh off the canonical mock state, so a mark made
 * through ANY range (the day-log's `useIntakeDays(date, date)`, the learning page's 14-day
 * range, …) is visible here too, whether or not this exact `[from, to]` was already cached.
 */
export function useIntakeDays(from: string, to: string): { days: IntakeDayStatus[]; isPending: boolean } {
  const { data, isPending } = useDualQuery<IntakeDayStatus[]>({
    queryKey: intakeDaysKey(from, to),
    mockData: intakeDaysSeed(from, to),
    realFetch: () => expenditureApi.days(from, to),
    realEmpty: EMPTY_DAYS,
  })
  return { days: data, isPending }
}

/**
 * Mock mode only: re-reads every currently-cached `['intakeDays', from, to]` query straight off
 * the canonical `mockState` (via `intakeDaysSeed`), keyed by each query's OWN `from`/`to` — so a
 * mark applied through one range is reflected in every other already-mounted range too.
 */
function refreshCachedIntakeDays(qc: QueryClient): void {
  for (const query of qc.getQueryCache().findAll({ queryKey: INTAKE_DAYS_PREFIX })) {
    const [, from, to] = query.queryKey as QueryKey & [string, string?, string?]
    qc.setQueryData(query.queryKey, intakeDaysSeed(from, to))
  }
}

/** Real mode's mark/clear/dismiss all invalidate the same set: every read the backend's
 *  re-chain (or a dismiss) can move. */
function invalidateExpenditureReads(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ['fuelDay'] })
  qc.invalidateQueries({ queryKey: ['goals'] })
  qc.invalidateQueries({ queryKey: EXPENDITURE_EXPLANATION_KEY })
  qc.invalidateQueries({ queryKey: EXPENDITURE_HISTORY_KEY })
  qc.invalidateQueries({ queryKey: EXPENDITURE_WEEKLY_CARD_KEY })
  qc.invalidateQueries({ queryKey: INTAKE_DAYS_PREFIX })
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
      input: { date: string } & MockIntakeDayMarkAction,
    ): Promise<IntakeDayMarkResult> => {
      if (mock) {
        const result = applyMockDayMark(input.date, input)
        refreshCachedIntakeDays(qc)
        return result
      }
      return input.kind === 'set'
        ? expenditureApi.setMark(input.date, input.status)
        : expenditureApi.clearMark(input.date)
    },
    onSuccess: mock ? undefined : () => invalidateExpenditureReads(qc),
  })

  return {
    setMark: (date, status) => mutation.mutateAsync({ date, kind: 'set', status }),
    clearMark: (date) => mutation.mutateAsync({ date, kind: 'clear' }),
    pending: mutation.isPending,
  }
}

/** Dismiss the weekly-summary card for one reviewed week — cross-device, per week (mezo-3n2so).
 *  Real mode invalidates the same set as mark/clear (§7): a dismiss is read through the same
 *  surfaces a re-chain is. */
export function useDismissWeeklyCard(): { dismiss: (weekStart: string) => Promise<void> } {
  const qc = useQueryClient()
  const mock = isMockMode()

  const mutation = useMutation({
    mutationFn: async (weekStart: string) => {
      if (mock) {
        dismissMockWeeklyCard()
        qc.setQueryData<ExpenditureWeeklyCard | null>(EXPENDITURE_WEEKLY_CARD_KEY, null)
        return
      }
      await expenditureApi.dismissWeeklyCard(weekStart)
    },
    onSuccess: mock ? undefined : () => invalidateExpenditureReads(qc),
  })

  return { dismiss: (weekStart) => mutation.mutateAsync(weekStart) }
}
