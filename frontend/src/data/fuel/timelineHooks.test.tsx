import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFuelTimeline } from '@/data/fuel/timelineHooks'
import { useFuelPreview } from '@/data/today/todayHooks'
import { deriveDailyBudget } from '@/features/fuel/logic/buildDayPlan'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import type { FuelSlot } from '@/data/types'

/** A wrapper bound to ONE QueryClient — so the co-composed hooks share a cache. */
function sharedWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

/** The day's meal + snack windows (excludes block + protocol slots). */
const mealWindows = (slots: FuelSlot[]) => slots.filter(s => s.kind === 'meal' || s.kind === 'snack')
const sumKcal = (slots: FuelSlot[]) => mealWindows(slots).reduce((a, s) => a + (s.kcal ?? 0), 0)
const sumP = (slots: FuelSlot[]) => mealWindows(slots).reduce((a, s) => a + (s.p ?? 0), 0)

// An active goal carrying the P5 day-planner settings + a prescription. A single
// week-spanning segment (1..999) keeps the current-week pick date-independent.
const goalWithSettings = {
  id: 'g1', title: 'Cut', trajectory: 'cut', guards: ['strength', 'muscle'], status: 'active',
  startDate: '2026-06-01', targetDate: '2026-08-15',
  startWeightKg: 81, targetWeightKg: 73, rateTargetPctPerWeek: 0.6, identityFrame: '',
  mealsPerDay: 4, wakeTime: '05:30', bedTime: '22:30', tdeeBootstrap: null,
  prescription: {
    generatedAt: '2026-05-22T06:05:00Z', basis: 'formula',
    segments: [
      { fromWeek: 1, toWeek: 999, label: 'Deficit', kcal: 2150, proteinG: 163, sleepTargetH: 7.5, restDays: [3, 7], projectedRateKgPerWk: -0.55, rationale: '' },
    ],
    guardStatus: {
      strength: { active: false, e1rmTrendPct: 0, breached: false, notes: [] },
      muscle: { active: false, minWeeklySetsPerMuscle: 0, belowMaintenanceMuscles: [], rateWithinCap: true, proteinMonitored: false, notes: [] },
    },
    feasibility: { verdict: 'feasible', notes: [] },
  },
}
const timelineFixture = { goalId: 'g1', weeks: 20, links: [], gaps: [] }
const stashFixture = [
  { id: 'kreatin', name: 'Kreatin', brand: 'MP', type: 'supplement', category: 'muscle', dose: '5g', form: 'por', stock: 30, stockUnit: 'adag', protocol: '', timing: 'morning', taken: false },
  { id: 'magnez', name: 'Magnézium-glicinát', brand: 'PE', type: 'supplement', category: 'sleep', dose: '300mg', form: 'kapszula', stock: 58, stockUnit: 'db', protocol: '', timing: 'evening', taken: false },
]

afterEach(() => vi.unstubAllEnvs())

describe('useFuelTimeline / useFuelPreview (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('mock: composes a deterministic COMPUTED plan (no static seed) — slots, one now-slot, settings + sleep-goal anchors', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper })
    const plan = result.current.plan
    // Same buildDayPlan composition as real mode, fed the mock seeds → a live-computed plan.
    expect(plan.slots.length).toBeGreaterThan(0)
    expect(plan.slots.filter(s => s.state === 'now')).toHaveLength(1) // fixed mock now 13:30 → exactly one
    expect(plan.caffeineCutoff).toBe('14:00')                          // fuel-settings ghost cutoff
    expect(plan.bedtime).toBe('23:15')                                 // mock sleep goal (wake 06:45 − 450m)
    expect(plan.kitchenClose).toBe('21:45')                            // bed 23:15 − 90m
    // Determinism (no ambient clock/random): a second independent render yields an equal plan.
    const { Wrapper: Wrapper2 } = sharedWrapper()
    const { result: result2 } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper2 })
    expect(result2.current.plan).toEqual(plan)
  })

  it('getScoredMeal resolves a done meal slot by id against the mock day (title-join is dead)', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper })
    const slot = result.current.plan.slots.find(s => s.kind === 'meal' && s.state === 'done' && s.mealId)!
    expect(result.current.getScoredMeal(slot)?.breakdown).toBeDefined()
    expect(
      result.current.getScoredMeal({ time: '09:15', kind: 'meal', label: 'x', state: 'done', mealName: 'Túrós zabkása · áfonyával' }),
    ).toBeNull()
  })

  it('useFuelPreview slices the same plan (visible ≤ 3 from the now-slot; shape unchanged)', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelPreview(), { wrapper: Wrapper })
    expect(result.current.visible.length).toBeGreaterThan(0)
    expect(result.current.visible.length).toBeLessThanOrEqual(3)
    expect(result.current.visible[0].state).toBe('now')
    expect(result.current).toHaveProperty('nextStack')
  })
})

describe('useFuelTimeline (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('composes goal settings + a logged meal + gym schedule + intakes into the planner', async () => {
    // Pin a Thursday (Csü) so the meso fixture's only gym day is "today". Fake ONLY Date so
    // waitFor's real timers keep working.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-02T16:30:00'))
    try {
      server.use(
        http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([goalWithSettings])),
        http.get(`${API_BASE}/api/goals/:id/timeline`, () => HttpResponse.json(timelineFixture)),
        http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: stashFixture })),
        http.get(`${API_BASE}/api/fuel/intake/:date`, () =>
          HttpResponse.json({ intakes: [{ id: 'i1', pantryItemId: 'kreatin', takenAt: '2026-07-02T05:40:00Z', takenDate: '2026-07-02', dose: '5g' }] }),
        ),
      )
      const { Wrapper } = sharedWrapper()
      const { result } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper })

      // The wake/bed anchor now comes from the SLEEP goal (mezo-dbsr) — the default
      // MSW /api/sleep/goal serves 06:45/23:15, so bed 23:15 → kitchenClose = bed − 90.
      await waitFor(() => expect(result.current.plan.bedtime).toBe('23:15'))
      expect(result.current.plan.kitchenClose).toBe('21:45')
      // Gym block flows through: Csü gym slot @ 18:30, meso day type 'Pull'.
      expect(result.current.plan.workout.start).toBe('18:30')
      expect(result.current.plan.workout.type).toBe('Pull')
      // The logged breakfast meal (default fuel-day fixture) renders done via the id-join.
      const doneMeal = result.current.plan.slots.find(s => s.mealId)
      expect(doneMeal?.state).toBe('done')
      expect(doneMeal?.kcal).toBe(580)
      // A supplement (protocol) slot exists, with the taken intake marked done.
      const wake = result.current.plan.slots.find(s => s.kind === 'wake')
      expect(wake).toBeDefined()
      expect(wake?.items?.some(it => it.done)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('daily budget derives from the current-week prescription segment (2150), not the seed (3100)', async () => {
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([goalWithSettings])),
      http.get(`${API_BASE}/api/goals/:id/timeline`, () => HttpResponse.json(timelineFixture)),
      http.get(`${API_BASE}/api/recipe`, () => HttpResponse.json({ recipes: [] })), // no fit → all windows budget-only
      http.get(`${API_BASE}/api/fuel/day/:date`, ({ params }) =>
        HttpResponse.json({
          date: String(params.date),
          targets: { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 },
          consumed: { kcal: 0, p: 0, c: 0, f: 0, water: 0 },
          meals: [],
        }),
      ),
    )
    const expected = deriveDailyBudget({ kcal: 2150, proteinG: 163 }, { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 })
    expect(expected.kcal).toBe(2150)

    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper })
    await waitFor(() => expect(sumKcal(result.current.plan.slots)).toBeGreaterThan(0))
    // splitBudget guarantees Σ per-slot budget === the daily budget, per macro.
    expect(sumKcal(result.current.plan.slots)).toBe(2150)
    expect(sumP(result.current.plan.slots)).toBe(163)
  })

  it('cold-load: meal windows from the fuel-settings cadence + the sleep-goal anchor + the day-targets fallback budget', async () => {
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])), // no weight goal → fuel-settings cadence + fallback budget
      http.get(`${API_BASE}/api/recipe`, () => HttpResponse.json({ recipes: [] })),
      http.get(`${API_BASE}/api/fuel/day/:date`, ({ params }) =>
        HttpResponse.json({
          date: String(params.date),
          targets: { kcal: 2800, p: 200, c: 300, f: 80, water: 4000 }, // distinct from the seed's 3100
          consumed: { kcal: 0, p: 0, c: 0, f: 0, water: 0 },
          meals: [],
        }),
      ),
    )
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper })
    // bed comes from the SLEEP goal (mezo-dbsr) — the default MSW /api/sleep/goal
    // resolves to 23:15 (waitFor covers the ghost→resolved flip); kitchenClose = bed − 90.
    await waitFor(() => expect(result.current.plan.bedtime).toBe('23:15'))
    await waitFor(() => expect(sumKcal(result.current.plan.slots)).toBe(2800))
    // mealsPerDay 4 (fuel-settings default, no weight goal) → 4 windows; bed 23:15 → kitchenClose 21:45.
    expect(mealWindows(result.current.plan.slots)).toHaveLength(4)
    expect(result.current.plan.kitchenClose).toBe('21:45')
    // Computed, not a static seed: the fallback used the live day-targets (2800), and no hand-authored
    // 05:50 wake slot leaks (the wake anchor is the sleep goal's 06:45).
    expect(result.current.plan.slots.some(s => s.time === '05:50' && s.label === 'Ébresztő')).toBe(false)
  })
})
