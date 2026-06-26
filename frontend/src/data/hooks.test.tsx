import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { useTodayScenario, useCheckins, useRecipes, useRecipeActions, useMedication } from './hooks'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// useTodayScenario now reads useMedication() (a ['medication'] query) for its real-mode
// retaDay base, so the router wrapper must also provide a fresh QueryClient.
const wrap = (path: string) => ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => vi.unstubAllEnvs())

test('useTodayScenario defaults: medium, retaDay 3, niggle on, vulnerable off, not anchor', () => {
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today') })
  expect(result.current).toEqual({ dayState: 'medium', retaDay: 3, niggle: true, vulnerable: false, anchorMode: false })
})
test('useTodayScenario parses params: rough → anchor, overrides', () => {
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today?day=rough&niggle=off&vulnerable=on&retaDay=6') })
  expect(result.current).toEqual({ dayState: 'rough', retaDay: 6, niggle: false, vulnerable: true, anchorMode: true })
})

test('useTodayScenario (real mode): retaDay derives from useMedication().cycle.retaDay', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { result } = renderHook(
    () => ({ scenario: useTodayScenario(), med: useMedication() }),
    { wrapper: wrap('/today') },
  )
  // before the ['medication'] query resolves the cycle is the ghost (retaDay 0),
  // so the scenario falls back to the mock default (3) — never a 0 day.
  expect(result.current.scenario.retaDay).toBe(3)
  // once the medication day resolves, the scenario broadcasts the derived cycle day.
  await waitFor(() => expect(result.current.med.cycle.retaDay).toBe(3))
  expect(result.current.scenario.retaDay).toBe(result.current.med.cycle.retaDay)
})

test('useTodayScenario (real mode): retaDay follows a non-default derived cycle day', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // a cycle on day 5 proves the scenario truly derives (not the coincidental default 3).
  server.use(http.get(`${API_BASE}/api/medication`, () =>
    HttpResponse.json({
      medication: { id: 'm', name: 'Reta', activeIngredient: '', route: '', cadence: '', defaultDose: 0, doseUnit: '', active: true, cycle: { cycleLengthDays: 7, phases: [] } },
      cycle: { retaDay: 5, phaseKey: 'stable', phaseLabel: '', lastDoseAt: null, week: [] },
      recentDoses: [],
    }),
  ))
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today') })
  await waitFor(() => expect(result.current.retaDay).toBe(5))
})

test('useTodayScenario (real mode): ?retaDay= override still wins over the derived cycle', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // MSW cycle is retaDay 3, but the URL override is top priority → 5.
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today?retaDay=5') })
  expect(result.current.retaDay).toBe(5)
  // stays 5 even after the medication day resolves.
  await new Promise(r => setTimeout(r, 0))
  expect(result.current.retaDay).toBe(5)
})

test('useTodayScenario (mock mode): retaDay defaults to today.retaDay, unchanged', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today') })
  expect(result.current.retaDay).toBe(3)
})
test('useCheckins.saveCheckIn marks a slot done with values', () => {
  const { result } = renderHook(() => useCheckins(), { wrapper: QueryWrapper })
  act(() => result.current.saveCheckIn(2, { state: 'done', values: { energy: 8, stress: 3, body: 7, mental: 8 }, note: null }))
  expect(result.current.checkins[2].state).toBe('done')
  expect(result.current.checkins[2].values?.energy).toBe(8)
})

test('useRecipes + useRecipeActions are re-exported from @/data/hooks', () => {
  expect(typeof useRecipes).toBe('function')
  expect(typeof useRecipeActions).toBe('function')
})
