import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery, DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import {
  recoveryApi,
  type RecoveryCheckInAnswer,
  type RecoveryState,
  type RecoveryUpsertRequest,
} from '@/data/train/recoveryApi'
import {
  recoveryEmpty,
  mockCheckIn,
  mockDiscard,
  mockOpen,
  mockRelease,
  mockUndoBetter,
  mockUnrelease,
  mockWaiveComeback,
} from '@/data/train/recoveryMock'
import { invalidateAfterWrite } from '@/data/train/skipHooks'
import { RECOVERY_QUERY_KEY } from '@/data/train/queryKeys'
import { localDateString } from '@/shared/lib/dates'

export { RECOVERY_QUERY_KEY } from '@/data/train/queryKeys'

/** The date-scoped key: the server's protected window is today-relative, so a session left open
 *  past midnight fetches a fresh window instead of serving yesterday's (the skip-window precedent). */
export const recoveryKey = () => [...RECOVERY_QUERY_KEY, localDateString()] as const

/**
 * Kímélő mód state (Kihagyás S2, mezo-q4xt2.2) — the open (or today-ended) period, the protected
 * dates in [today−7, today+13] and the comeback ramp. Dual-mode per `skipHooks.ts`: mock mode is a
 * client-owned cache starting with no period, edited by `recoveryMock.ts`'s transitions; real mode
 * trusts the server verbatim. `useTrain().plannedSkips` folds the protected dates in as DAY rows.
 */
export function useRecovery() {
  const { data, isPending, isError } = useDualQuery<RecoveryState>({
    queryKey: recoveryKey(),
    mockData: recoveryEmpty,
    realFetch: () => recoveryApi.get(),
    realEmpty: recoveryEmpty,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { recovery: data, isPending, isError }
}

/** Real mode: every read a recovery write can move — the skip dependents (`skipHooks`), this
 *  state, today's workout (the ramp / released day), the meso (a shift moves its dates, current
 *  week and — STEP_BACK — its weekly sets) and the Fuel day. Mock mode never invalidates: its
 *  caches are client-owned and a refetch would clobber them with their seeds. */
function invalidateAfterRecoveryWrite(qc: QueryClient): void {
  invalidateAfterWrite(qc) // planned skips, today workout/readiness, week, meso report, quests, fuelDay
  void qc.invalidateQueries({ queryKey: RECOVERY_QUERY_KEY })
  void qc.invalidateQueries({ queryKey: ['train', 'mesocycles'] }) // the current meso
  void qc.invalidateQueries({ queryKey: ['train', 'mesoVolumeArc'] }) // the meso's weekly volume
}

/** One recovery write: mock → a pure transition over the cached state; real → the API call.
 *  Either way the answered state replaces the cache; real mode also invalidates its dependents. */
function useRecoveryWrite<V>(
  mockFn: (prev: RecoveryState, vars: V) => RecoveryState,
  realFn: (vars: V) => Promise<RecoveryState | null>,
) {
  const mock = isMockMode()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: V): Promise<RecoveryState | null> => {
      if (mock) return mockFn(qc.getQueryData<RecoveryState>(recoveryKey()) ?? recoveryEmpty, vars)
      return realFn(vars)
    },
    onSuccess: (next) => {
      if (next) qc.setQueryData(recoveryKey(), next)
      if (!mock) invalidateAfterRecoveryWrite(qc)
    },
  })
}

/** Open a period — or change the open one's category/estimate. */
export const useOpenRecovery = () =>
  useRecoveryWrite<RecoveryUpsertRequest>(
    (prev, req) => mockOpen(prev, req),
    (req) => recoveryApi.upsert(req),
  )

/** Daily check-in: BETTER ends the period today and applies the return rule; NOT_YET keeps it. */
export const useRecoveryCheckIn = () =>
  useRecoveryWrite<RecoveryCheckInAnswer>(
    (prev, answer) => mockCheckIn(prev, answer),
    (answer) => recoveryApi.checkIn(answer),
  )

/** „Mégsem vagyok jól" — reopen the period ended today, reverting the shift. */
export const useUndoBetter = () =>
  useRecoveryWrite<void>(
    (prev) => mockUndoBetter(prev),
    () => recoveryApi.undoBetter(),
  )

/** „Tévedés volt" — discard the open (or today-ended) period. The server answers 204; the cache
 *  is cleared to the empty state (real mode then refetches it). */
export const useDiscardRecovery = () =>
  useRecoveryWrite<void>(
    (prev) => mockDiscard(prev),
    () => recoveryApi.discard().then(() => recoveryEmpty),
  )

/** „Ma mégis edzek" — train on one protected date (lighter by default). */
export const useReleaseDay = () =>
  useRecoveryWrite<{ date: string; lighten?: boolean }>(
    (prev, { date, lighten = true }) => mockRelease(prev, date, lighten),
    ({ date, lighten = true }) => recoveryApi.release(date, lighten),
  )

/** Undo „Ma mégis edzek" — the date is protected again. */
export const useUnreleaseDay = () =>
  useRecoveryWrite<string>(
    (prev, date) => mockUnrelease(prev, date),
    (date) => recoveryApi.unrelease(date),
  )

/** „Kikapcsolom a könnyítést" — switch off the comeback ramp. */
export const useWaiveComeback = () =>
  useRecoveryWrite<void>(
    (prev) => mockWaiveComeback(prev),
    () => recoveryApi.waiveComeback(),
  )
