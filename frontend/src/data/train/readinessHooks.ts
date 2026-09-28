import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { readinessApi, type ReadinessChoice, type ReadinessTodayResponse } from '@/data/train/readinessApi'
import { readinessEmpty, readinessMock } from '@/data/train/readinessMock'
import { WORKOUT_TODAY_QUERY_KEY, READINESS_TODAY_QUERY_KEY } from '@/data/train/queryKeys'

// Re-exported so every existing `import { READINESS_TODAY_QUERY_KEY } from
// '@/data/train/readinessHooks'` keeps compiling — the constant itself now lives in
// `queryKeys.ts` (a dependency-free leaf), alongside `WORKOUT_TODAY_QUERY_KEY`, so `skipHooks.ts`
// can invalidate both without importing `trainHooks.ts`/`readinessHooks.ts` directly (Kihagyás S1,
// mezo-q4xt2.1 — see `queryKeys.ts` for the full "why").
export { READINESS_TODAY_QUERY_KEY } from '@/data/train/queryKeys'

type Action = { kind: 'choose'; choice: ReadinessChoice } | { kind: 'undo' }

/** What the mock server would answer — the choice moves the state, the reasons stay. */
function mockAfter(prev: ReadinessTodayResponse, action: Action): ReadinessTodayResponse {
  if (action.kind === 'undo') return { ...prev, state: 'OFFER' }
  return { ...prev, state: action.choice === 'LIGHTEN' ? 'LIGHTENED' : 'KEPT' }
}

/**
 * Check-in 2.0 training readiness (mezo-ck2) — the Edzés today card's read + the day's choice.
 * Dual-mode per frontend_conventions.md §4: mock mode serves the prototype seed synchronously and
 * keeps the choice in the query cache; real mode fetches and shows `state: NONE` (never the seed)
 * while unresolved. A choice answers with the fresh readiness, which replaces the cache; in real
 * mode it also invalidates today's workout, whose prescriptions the LIGHTEN overlay changes.
 */
export function useTodayReadiness() {
  const mock = isMockMode()
  const qc = useQueryClient()
  const { data, isPending } = useDualQuery<ReadinessTodayResponse>({
    queryKey: READINESS_TODAY_QUERY_KEY,
    mockData: readinessMock,
    realFetch: () => readinessApi.today(),
    realEmpty: readinessEmpty,
  })

  const mutation = useMutation({
    mutationFn: async (action: Action): Promise<ReadinessTodayResponse> => {
      if (mock) {
        const prev = qc.getQueryData<ReadinessTodayResponse>(READINESS_TODAY_QUERY_KEY) ?? readinessMock
        return mockAfter(prev, action)
      }
      return action.kind === 'undo' ? readinessApi.undo() : readinessApi.choose(action.choice)
    },
    onSuccess: (next) => {
      qc.setQueryData(READINESS_TODAY_QUERY_KEY, next)
      if (!mock) void qc.invalidateQueries({ queryKey: WORKOUT_TODAY_QUERY_KEY })
    },
  })

  // `onDone` runs only on success (a failure is toasted by the global mutation cache).
  const { mutate } = mutation
  const choose = useCallback(
    (choice: ReadinessChoice, onDone?: () => void) =>
      mutate({ kind: 'choose', choice }, { onSuccess: () => onDone?.() }),
    [mutate],
  )
  const undo = useCallback(
    (onDone?: () => void) => mutate({ kind: 'undo' }, { onSuccess: () => onDone?.() }),
    [mutate],
  )

  return { readiness: data, isPending, choose, undo, saving: mutation.isPending }
}
