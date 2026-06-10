import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useGoals } from './hooks'
import { server } from '@/test/msw/server'

const BASE = 'http://localhost:8080'

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

test('useGoals (real mode) loads the weight log from the API', async () => {
  const { result } = renderHook(() => useGoals(), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.weightLog.length).toBe(1))
  expect(result.current.weightLog[0]).toMatchObject({ date: '2026-06-01', value: 82.5 })
})

test('useGoals.logWeight POSTs and the new entry appears after invalidation', async () => {
  let posted = false
  // After the POST fires, the GET must return the appended list (server-side truth).
  server.use(
    http.post(`${BASE}/api/biometrics/weight`, async ({ request }) => {
      posted = true
      const body = (await request.json()) as { date: string; weightKg: number; note?: string | null }
      return HttpResponse.json({ id: 'w2', date: body.date, value: body.weightKg, note: body.note ?? null }, { status: 201 })
    }),
    http.get(`${BASE}/api/biometrics/weight`, () =>
      HttpResponse.json(
        posted
          ? [
              { id: 'w1', date: '2026-06-01', value: 82.5, note: null },
              { id: 'w2', date: '2026-06-02', value: 81.9, note: null },
            ]
          : [{ id: 'w1', date: '2026-06-01', value: 82.5, note: null }],
      ),
    ),
  )

  const { result } = renderHook(() => useGoals(), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.weightLog.length).toBe(1))

  act(() => {
    result.current.logWeight({ date: '2026-06-02', weightKg: 81.9 })
  })

  await waitFor(() => expect(posted).toBe(true))
  await waitFor(() => expect(result.current.weightLog.length).toBe(2))
  expect(result.current.weightLog[1]).toMatchObject({ date: '2026-06-02', value: 81.9 })
})
