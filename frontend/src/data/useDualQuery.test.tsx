import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDualQuery } from '@/data/useDualQuery'

const SEED = ['seed-a', 'seed-b']
const EMPTY: string[] = []
const REAL = ['real-1']

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

afterEach(() => vi.unstubAllEnvs())

describe('useDualQuery', () => {
  it('mock mode: returns the seed synchronously on the first render', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(
      () => useDualQuery({ queryKey: ['dq-mock'], mockData: SEED, realFetch: async () => REAL, realEmpty: EMPTY }),
      { wrapper: makeWrapper() },
    )
    // mock mode: initialData seeds the first render synchronously, byte-identical seed
    expect(result.current.data).toBe(SEED)
  })

  it('real mode: returns realEmpty (NOT the seed) while the query is unresolved', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    // a fetch that never resolves → the hook stays in the loading window
    const realFetch = () => new Promise<string[]>(() => {})
    const { result } = renderHook(
      () => useDualQuery({ queryKey: ['dq-real-pending'], mockData: SEED, realFetch, realEmpty: EMPTY }),
      { wrapper: makeWrapper() },
    )
    // THE INVARIANT: real mode never flashes the mock seed — unresolved → realEmpty
    expect(result.current.data).toBe(EMPTY)
    expect(result.current.data).not.toBe(SEED)
  })

  it('real mode: returns the fetched data once the query resolves', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const { result } = renderHook(
      () => useDualQuery({ queryKey: ['dq-real-resolve'], mockData: SEED, realFetch: async () => REAL, realEmpty: EMPTY }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.data).toBe(REAL))
  })

  it('real mode: isError flips true on a failed fetch — a consumer can render an error state (mezo-n5e9.2 fix wave)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const realFetch = () => Promise.reject(new Error('boom'))
    const { result } = renderHook(
      () => useDualQuery({ queryKey: ['dq-real-error'], mockData: SEED, realFetch, realEmpty: EMPTY }),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isError).toBe(false)
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBe(EMPTY) // still never the mock seed
  })

  it('mock mode: isError is always false (the mock queryFn never rejects)', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(
      () => useDualQuery({ queryKey: ['dq-mock-error'], mockData: SEED, realFetch: async () => REAL, realEmpty: EMPTY }),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isError).toBe(false)
  })

  it('real mode: keepPreviousRealData keeps the PREVIOUS key’s data while the new key resolves (mezo-b3pp.15)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const FIRST = ['first']
    const SECOND = ['first', 'second']
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => {
      release = r
    })
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) =>
        useDualQuery({
          queryKey: ['dq-keep', n],
          mockData: SEED,
          realFetch: n === 1 ? async () => FIRST : async () => {
            await gate
            return SECOND
          },
          realEmpty: EMPTY,
          keepPreviousRealData: true,
        }),
      { wrapper: makeWrapper(), initialProps: { n: 1 } },
    )
    await waitFor(() => expect(result.current.data).toBe(FIRST))
    rerender({ n: 2 })
    // the key changed and the new fetch is still open — the previous REAL response stays…
    expect(result.current.data).toBe(FIRST)
    expect(result.current.data).not.toBe(SEED) // …and it is never the mock seed
    release()
    await waitFor(() => expect(result.current.data).toBe(SECOND))
  })

  it('real mode: WITHOUT the flag a key change still drops to realEmpty (existing callers unchanged)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const FIRST = ['first']
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) =>
        useDualQuery({
          queryKey: ['dq-nokeep', n],
          mockData: SEED,
          realFetch: n === 1 ? async () => FIRST : () => new Promise<string[]>(() => {}),
          realEmpty: EMPTY,
        }),
      { wrapper: makeWrapper(), initialProps: { n: 1 } },
    )
    await waitFor(() => expect(result.current.data).toBe(FIRST))
    rerender({ n: 2 })
    expect(result.current.data).toBe(EMPTY)
  })

  it('refetch() re-runs the query — a failed real-mode fetch can recover without a remount', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let attempt = 0
    const realFetch = () => {
      attempt += 1
      return attempt === 1 ? Promise.reject(new Error('boom')) : Promise.resolve(REAL)
    }
    const { result } = renderHook(
      () => useDualQuery({ queryKey: ['dq-real-refetch'], mockData: SEED, realFetch, realEmpty: EMPTY }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    result.current.refetch()
    await waitFor(() => expect(result.current.data).toBe(REAL))
    expect(result.current.isError).toBe(false)
  })
})
