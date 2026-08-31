import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'

/**
 * The app-wide real-mode query staleTime — the value `QueryProvider` puts on the QueryClient —
 * exported so a hook that wants exactly that value can ASK for it (see `realStaleTime` below for
 * why asking is necessary; mezo-5cmq).
 */
export const DEFAULT_QUERY_STALE_TIME_MS = 30_000

/**
 * The dual-mode read recipe with the **"no static fallback in real mode"** invariant
 * baked in (see docs/features/_platform-data-layer.md §"The 'no static fallback in real
 * mode → ghost-guard' rule").
 *
 * - **Mock mode:** seeds `mockData` SYNCHRONOUSLY via `initialData` (no loading frame —
 *   keeps component tests byte-identical to Phase-1) and never
 *   background-refetches (`staleTime: Infinity`).
 * - **Real mode:** fetches from the backend and, while the query is UNRESOLVED, returns
 *   `realEmpty` — **NEVER the mock seed.** This is what stops the Phase-1 demo seed from
 *   flashing into a real-mode (live) user's screen during the cold-load window
 *   (the mezo-yew / mezo-0xl bug class: fake recipes/pantry/macros before real data lands).
 *
 * Use this for EVERY dual-mode read hook instead of `const { data = mockSeed } = useQuery(...)`
 * — that destructuring-default pattern leaks the seed into real mode (the default fires whenever
 * `data` is undefined, which includes the entire real-mode loading window). The dualMode guard
 * test (`src/data/dualMode.guard.test.ts`) fails the build if the leaky pattern reappears.
 */
export function useDualQuery<T>(opts: {
  queryKey: QueryKey
  mockData: T
  realFetch: () => Promise<T>
  realEmpty: T
  /**
   * Real-mode staleTime (mock mode is always Infinity).
   *
   * Omitting does NOT fall back to the QueryClient default, despite appearances: this helper
   * always passes the `staleTime` key, so an omitted value sends `staleTime: undefined`, and
   * TanStack's `defaultQueryOptions` merges by plain spread — the `undefined` OVERWRITES the
   * client's default and the query ends up ALWAYS-STALE (staleTime 0), refetching once per
   * mounted observer. To get the app default, pass `DEFAULT_QUERY_STALE_TIME_MS` explicitly
   * (mezo-5cmq). Most existing callers omit it and are therefore always-stale — auditing them
   * is its own issue, not something to assume away when reading them.
   */
  realStaleTime?: number
  /**
   * Real mode only, opt-in (mezo-b3pp.15): when the queryKey CHANGES, keep the previous key's
   * already-fetched data on screen while the new key resolves, instead of dropping to `realEmpty`.
   *
   * For a hook whose key encodes the set of rows a page is asking about (`useFeedback`), the key
   * changes every time the page grows by one item — and without this every already-known value
   * blanks for the width of a round-trip. It is `placeholderData: keepPreviousData`, i.e. the
   * PREVIOUS REAL RESPONSE — never `mockData` — so the "no static fallback in real mode"
   * invariant above is untouched. Omitted/false ⇒ `placeholderData: undefined`, which is
   * identical to not passing the option at all: no existing caller's behaviour can change.
   */
  keepPreviousRealData?: boolean
}): { data: T; isPending: boolean; isError: boolean; refetch: () => void } {
  const mock = isMockMode()
  const q = useQuery({
    queryKey: opts.queryKey,
    queryFn: mock ? async () => opts.mockData : opts.realFetch,
    initialData: mock ? opts.mockData : undefined,
    staleTime: mock ? Infinity : opts.realStaleTime,
    placeholderData: !mock && opts.keepPreviousRealData ? keepPreviousData : undefined,
  })
  return {
    // mock: q.data is always the seed (initialData). real: the fetched value, or — while
    // unresolved (q.data === undefined) — realEmpty, never the seed.
    data: q.data ?? (mock ? opts.mockData : opts.realEmpty),
    isPending: q.isPending,
    // Additive (mezo-n5e9.2 fix wave): existing `{data, isPending}` consumers are unaffected —
    // `q.isError`/`q.refetch` pass straight through so a screen CAN render a terminal error
    // state + a retry instead of the misleading "empty, go ahead and create" read `realEmpty`
    // gives a genuinely-failed fetch. Mock mode's queryFn never rejects, so `isError` is always
    // false there.
    isError: q.isError,
    refetch: () => { void q.refetch() },
  }
}
