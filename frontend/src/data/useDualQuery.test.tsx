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
})
