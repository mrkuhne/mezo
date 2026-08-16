import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { useTodayScenario, useCheckins, useRecipes, useRecipeActions, useMedication } from '@/data/hooks'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { medicationFixture } from '@/test/fixtures/medication'

// useTodayScenario now reads useMedication() (a ['medication'] query) for its real-mode
// medCycleDay base, so the router wrapper must also provide a fresh QueryClient.
const wrap = (path: string) => ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => vi.unstubAllEnvs())

test('useTodayScenario defaults: medium, medCycleDay 0 (nincs gyógyszer), niggle on, vulnerable off, not anchor, no ritual override', () => {
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today') })
  expect(result.current).toEqual({ dayState: 'medium', medCycleDay: 0, niggle: true, vulnerable: false, anchorMode: false, ritual: null })
})
test('useTodayScenario parses params: rough → anchor, overrides', () => {
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today?day=rough&niggle=off&vulnerable=on&medCycleDay=6') })
  expect(result.current).toEqual({ dayState: 'rough', medCycleDay: 6, niggle: false, vulnerable: true, anchorMode: true, ritual: null })
})
test('useTodayScenario ?ritual= is whitelist-validated (mirrors the day/dayState idiom): valid values pass through, anything else falls back to null', () => {
  const valid = (v: string) => renderHook(() => useTodayScenario(), { wrapper: wrap(`/today?ritual=${v}`) }).result.current.ritual
  expect(valid('waiting')).toBe('waiting')
  expect(valid('open')).toBe('open')
  expect(valid('done')).toBe('done')
  expect(valid('bogus')).toBeNull()
  expect(renderHook(() => useTodayScenario(), { wrapper: wrap('/today') }).result.current.ritual).toBeNull()
})

test('useTodayScenario (real mode): medCycleDay derives from useMedication().cycle.cycleDay', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
  const { result } = renderHook(
    () => ({ scenario: useTodayScenario(), med: useMedication() }),
    { wrapper: wrap('/today') },
  )
  // before the ['medication'] query resolves the cycle is the ghost (cycleDay 0) — the scenario
  // has no fallback, so it is honestly 0 too (mezo-lwmq: no medication is the normal state).
  expect(result.current.scenario.medCycleDay).toBe(0)
  // once the medication day resolves, the scenario broadcasts the derived cycle day.
  await waitFor(() => expect(result.current.med.cycle.cycleDay).toBe(3))
  expect(result.current.scenario.medCycleDay).toBe(result.current.med.cycle.cycleDay)
})

test('useTodayScenario (real mode): medCycleDay follows a non-default derived cycle day', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // a cycle on day 5 proves the scenario truly derives (not the coincidental default 3).
  server.use(http.get(`${API_BASE}/api/medication`, () =>
    HttpResponse.json({
      medication: { id: 'm', name: 'Gyógyszer', activeIngredient: '', route: '', cadence: '', defaultDose: 0, doseUnit: '', active: true, cycle: { cycleLengthDays: 7, phases: [] } },
      cycle: { cycleDay: 5, phaseKey: 'stable', phaseLabel: '', lastDoseAt: null, week: [] },
      recentDoses: [],
    }),
  ))
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today') })
  await waitFor(() => expect(result.current.medCycleDay).toBe(5))
})

test('useTodayScenario (real mode): ?medCycleDay= override still wins over the derived cycle', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // The fixture's derived cycle is cycleDay 3, but the URL override is top priority → 5.
  server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today?medCycleDay=5') })
  expect(result.current.medCycleDay).toBe(5)
  // stays 5 even after the medication day resolves (to cycleDay 3, not 5 — proves the override
  // isn't just coincidentally matching the derived value).
  await new Promise(r => setTimeout(r, 0))
  expect(result.current.medCycleDay).toBe(5)
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
