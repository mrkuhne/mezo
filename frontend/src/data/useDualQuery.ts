import { useQuery, type QueryKey } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'

/**
 * The dual-mode read recipe with the **"no static fallback in real mode"** invariant
 * baked in (see docs/features/_platform-data-layer.md §"The 'no static fallback in real
 * mode → ghost-guard' rule").
 *
 * - **Mock mode:** seeds `mockData` SYNCHRONOUSLY via `initialData` (no loading frame —
 *   keeps Playwright parity + component tests byte-identical to Phase-1) and never
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
  /** real-mode staleTime (mock mode is always Infinity). Omit → TanStack app default. */
  realStaleTime?: number
}): { data: T; isPending: boolean } {
  const mock = isMockMode()
  const q = useQuery({
    queryKey: opts.queryKey,
    queryFn: mock ? async () => opts.mockData : opts.realFetch,
    initialData: mock ? opts.mockData : undefined,
    staleTime: mock ? Infinity : opts.realStaleTime,
  })
  return {
    // mock: q.data is always the seed (initialData). real: the fetched value, or — while
    // unresolved (q.data === undefined) — realEmpty, never the seed.
    data: q.data ?? (mock ? opts.mockData : opts.realEmpty),
    isPending: q.isPending,
  }
}
