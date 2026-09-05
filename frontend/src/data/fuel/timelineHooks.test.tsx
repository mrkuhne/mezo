import type { ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFuelTimeline, deriveBlocks } from '@/data/fuel/timelineHooks'
import { useFuelPreview } from '@/data/today/todayHooks'
import { deriveDailyBudget } from '@/features/fuel/logic/buildDayPlan'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import type { FuelSlot, SlotTemplate, SportSchedule, VolleyballSession } from '@/data/types'

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

// deriveBlocks must carry the session's sport identity into the planner block label so the
// Fuel "Mai" timeline (and the energy-breakdown sheet) name a cross/TRX session correctly
// instead of the old hardcoded 'Volleyball' (mezo-rhe5).
describe('deriveBlocks — sport block label reflects the session sport (mezo-rhe5)', () => {
  const scheduleWithSport = (sport: VolleyballSession['sport']): SportSchedule => ({
    volleyball: {
      team: 'BVSC', season: 'Tavasz', weeklyHours: 5,
      sessions: [{ day: 'Hét', time: '18:00', duration: 90, court: 'BVSC', intensity: 'közepes', role: 'edzés', sport, today: true }],
    },
  })
  const sportLabel = (sport: VolleyballSession['sport']) =>
    deriveBlocks(null, { schedule: scheduleWithSport(sport) }, null).find(b => b.kind === 'sport')?.label

  it('labels a cross-training session Cross, not Volleyball', () => {
    expect(sportLabel('cross')).toBe('Cross')
  })

  it('labels a TRX session TRX', () => {
    expect(sportLabel('trx')).toBe('TRX')
  })

  it('defaults an unmarked session to Volleyball (Phase-1 mock default)', () => {
    expect(sportLabel(undefined)).toBe('Volleyball')
  })
})

// A stacked day — a recurring slot + a dated one-off event (mezo-e1sp) — must yield one
// sport block per today-session; the old single `.find` silently dropped every session
// after the first from the calorie budget (activityKcal) and the meal windows.
describe('deriveBlocks — every today-session becomes a block (mezo-e1sp)', () => {
  it('emits one sport block per today-session on a stacked day', () => {
    const schedule: SportSchedule = {
      volleyball: {
        team: '', season: '', weeklyHours: 5,
        sessions: [
          { day: 'Hét', time: '12:00', duration: 60, court: '', intensity: '', role: 'edzés', sport: 'trx', today: true },
          { day: 'Hét', time: '19:00', duration: 90, court: '', intensity: '', role: 'meccs', sport: 'volleyball', today: true, oneOff: true, date: '2026-08-03' },
        ],
      },
    }
    const blocks = deriveBlocks(null, { schedule }, null).filter((b) => b.kind === 'sport')
    expect(blocks.map((b) => [b.time, b.durationMin, b.label])).toEqual([
      ['12:00', 60, 'TRX'],
      ['19:00', 90, 'Volleyball'],
    ])
  })
})

describe.skipIf(import.meta.env.VITE_USE_MOCK === 'false')('useFuelTimeline / useFuelPreview (mock mode)', () => {
  it('mock: composes a deterministic COMPUTED plan (no static seed) — slots, one now-slot, settings + sleep-goal anchors', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper })
    const plan = result.current.plan
    // Same buildDayPlan composition as real mode, fed the mock seeds → a live-computed plan.
    expect(plan.slots.length).toBeGreaterThan(0)
    // Fixed-plan state: breakfast/lunch and the future dinner fixture are logged, so the sole
    // unfilled meal window is `now` at 13:30; there is no later meal window left pending.
    const nowSlots = plan.slots.filter(s => s.state === 'now')
    expect(nowSlots).toHaveLength(1)
    expect(nowSlots[0].slotKey).toBeDefined()                          // a meal window carries the `now`
    expect(plan.slots.some(s => s.slotKey && s.state === 'pending')).toBe(false)
    expect(plan.caffeineCutoff).toBe('14:00')                          // fuel-settings ghost cutoff
    expect(plan.bedtime).toBe('23:15')                                 // mock sleep goal (wake 06:45 − 450m)
    expect(plan.kitchenClose).toBe('21:45')                            // bed 23:15 − 90m
    // Determinism (no ambient clock/random): a second independent render yields an equal plan.
    const { Wrapper: Wrapper2 } = sharedWrapper()
    const { result: result2 } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper2 })
    expect(result2.current.plan).toEqual(plan)
  })

  it('mock timeline carries a DYNAMIC energy breakdown (base + activity + balance → target)', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper })
    const e = result.current.plan.energy
    expect(e.base).toBeGreaterThan(0) // BMR×NEAT maintenance flows through
    expect(Number.isFinite(e.activity)).toBe(true)
    expect(Number.isFinite(e.balance)).toBe(true)
    expect(e.target).toBeGreaterThan(0) // undefined/NaN energy (unplumbed) would fail here
    // The mock day always carries a gym block (hardcoded today:true) → the DYNAMIC path
    // (weightKg + blocks plumbed) burns real MET activity. The unwired static path leaves
    // activity at 0, so this is the assertion that flips red→green when the inputs are wired.
    expect(e.activity).toBeGreaterThan(0)
    // Dynamic base is BMR×NEAT (1720×1.2 = 2064), NOT the segment kcal the static path echoed.
    expect(e.base).toBe(2064)
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

  it('returns the day anchor + injected now so view-side zone math needs no clock (mezo-rrtj)', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper })
    expect(result.current.wake).toMatch(/^\d{2}:\d{2}$/)
    expect(result.current.bed).toMatch(/^\d{2}:\d{2}$/)
    // Mock mode pins the demo clock (spec D6) — the page must never read Date.now().
    expect(result.current.nowHHmm).toBe('13:30')
  })
})

describe.skipIf(import.meta.env.VITE_USE_MOCK !== 'false')('useFuelTimeline (real mode)', () => {
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
        // A living-protocol occurrence for kreatin at the wake zone (mezo-vx9v Task 9 — the
        // "Mai" timeline now projects `occurrences`, not a selection-derived buildProtocol).
        http.get(`${API_BASE}/api/fuel/protocol`, () =>
          HttpResponse.json({
            active: {
              id: 'proto-1', version: 1, builtAt: '2026-07-02T06:00:00Z', status: 'active',
              confidence: 0.9,
              items: [
                {
                  id: 'occ-kreatin', pantryItemId: 'kreatin', slotKey: 'wake', dose: '5g',
                  pinned: false, placementSource: 'rule', placementReason: null,
                },
              ],
            },
            history: [],
          }),
        ),
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
      // Pin the training inputs empty too: the default sport-schedule fixture carries a ≥90-min
      // slot on most weekdays, which correctly earns a peri-workout snack window (mezo-1oy5) and
      // made the expected window count weekday-dependent (a latent flake — it only stayed green
      // while the schedule query happened to resolve after the assertions; surfaced by mezo-e1sp's
      // extra sport-events query shifting resolution order). Cold-load here means a PLAIN day.
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
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

  // Task 7 (mezo-7102): resolveDayType(blocks) picks the cached template matching today's REAL
  // day type, and buildDayPlan folds its anchors straight into plan.slots (compileTemplate
  // replaces placeWindows for this day). A blockless day (no gym/sport/running today, same
  // empty-schedule overrides the cold-load test above uses) → resolveDayType → 'rest', so a
  // 'rest' template is the deterministic match — no dependency on which weekday the suite runs on.
  it('resolves the rest-day template and folds its anchors into plan.slots (mezo-7102)', async () => {
    const restTemplate: SlotTemplate = {
      dayType: 'rest',
      slots: [
        { label: 'Reggeli 8:00 30%', slotKind: 'breakfast', role: 'standard', anchor: { type: 'fixed', time: '08:00' }, budgetPct: 30 },
        { label: 'Ebéd 1 12:30 40%', slotKind: 'lunch', role: 'standard', anchor: { type: 'fixed', time: '12:30' }, budgetPct: 40 },
        { label: 'Vacsora 19:00 30%', slotKind: 'dinner', role: 'standard', anchor: { type: 'fixed', time: '19:00' }, budgetPct: 30 },
      ],
    }
    // Wire-shape mirror of restTemplate — backs the GET handler so a background refetch (the
    // real-mode useDualQuery staleTime triggers one on mount) converges on the SAME template the
    // direct cache seed below provides, instead of racing it back down to the default empty list.
    const restTemplateWire = {
      templates: [{
        dayType: restTemplate.dayType,
        slots: restTemplate.slots.map(s => ({
          label: s.label, slotKind: s.slotKind, role: s.role, budgetPct: s.budgetPct,
          anchorType: s.anchor.type, time: s.anchor.type === 'fixed' ? s.anchor.time : undefined,
        })),
      }],
    }
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])), // no weight goal
      http.get(`${API_BASE}/api/recipe`, () => HttpResponse.json({ recipes: [] })),
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/fuel/day/:date`, ({ params }) =>
        HttpResponse.json({
          date: String(params.date),
          targets: { kcal: 2800, p: 200, c: 300, f: 80, water: 4000 },
          consumed: { kcal: 0, p: 0, c: 0, f: 0, water: 0 },
          meals: [],
        }),
      ),
      http.get(`${API_BASE}/api/fuel/slot-templates`, () => HttpResponse.json(restTemplateWire)),
    )
    const { qc, Wrapper } = sharedWrapper()
    qc.setQueryData(['fuelSlotTemplates'], [restTemplate])
    const { result } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.plan.bedtime).toBe('23:15')) // sleep goal resolved
    expect(result.current.dayType).toBe('rest')
    expect(result.current.template).toEqual(restTemplate)
    const byLabel = (label: string) => result.current.plan.slots.find(s => s.label === label)
    expect(byLabel('Reggeli 8:00 30%')?.time).toBe('08:00')
    expect(byLabel('Ebéd 1 12:30 40%')?.time).toBe('12:30')
    expect(byLabel('Vacsora 19:00 30%')?.time).toBe('19:00')
  })

  // Zero-regression (mezo-7102): with NO cached template, useSlotTemplates resolves the default
  // empty list (real mode's honest-empty MSW handler) → `template` is null and buildDayPlan keeps
  // today's placeWindows/splitBudget path — the pre-Task-7 behavior, unchanged.
  it('with no cached template, dayType/template are additive and the plan is unaffected (mezo-7102)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelTimeline(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.plan.bedtime).toBe('23:15'))
    expect(result.current.dayType).toMatch(/^(rest|training_am|training_pm)$/)
    expect(result.current.template).toBeNull()
  })
})
