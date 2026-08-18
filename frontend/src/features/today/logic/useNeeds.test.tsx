import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { mockSleepGoal } from '@/data/me/sleepGoal'
import { fuelDay } from '@/data/fuel/fuel'
import { sleepLog } from '@/data/me/sleep'
import { runSessionsMock } from '@/data/train/running'
import { mockActivities } from '@/data/activity/activityMock'
import { initialCheckins } from '@/data/today/checkins'
import { mockIntentionDay } from '@/data/intention/intentionMock'
import { EMPTY_RITUAL_DAY } from '@/data/ritual/ritualMock'
import { mockHabitDay } from '@/data/habit/habitMock'

// ============================================================
// Every `@/data/hooks` export `useNeeds` calls is module-mocked (hoisted idiom,
// TodayPage.dispatch.test.tsx precedent) so BOTH describe blocks below — mock-mode's original
// sim-shape coverage and the fix-wave real-mode composite-readiness-gate coverage — render
// against the exact same seed data via a single, deterministic path, no reliance on real
// fetch/mock-query timing. `mockAllResolved()` (the shared top-level `beforeEach`) is the
// "everything has landed" baseline; the real-mode pending tests each flip exactly ONE
// contributing flag off that baseline.
// ============================================================
const mocks = vi.hoisted(() => ({
  useSleepGoal: vi.fn(),
  useFuelDay: vi.fn(),
  useSleep: vi.fn(),
  useTrain: vi.fn(),
  useRunning: vi.fn(),
  useActivities: vi.fn(),
  useCheckins: vi.fn(),
  useIntentionDay: vi.fn(),
  useRitualDay: vi.fn(),
  useHabitDay: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...orig,
    useSleepGoal: mocks.useSleepGoal,
    useFuelDay: mocks.useFuelDay,
    useSleep: mocks.useSleep,
    useTrain: mocks.useTrain,
    useRunning: mocks.useRunning,
    useActivities: mocks.useActivities,
    useCheckins: mocks.useCheckins,
    useIntentionDay: mocks.useIntentionDay,
    useRitualDay: mocks.useRitualDay,
    useHabitDay: mocks.useHabitDay,
  }
})

/** Every consumed read resolved — the "cold load finished" baseline. Pending-source tests
 *  flip exactly one flag off this. Values are the app's own seed fixtures (not empty stubs)
 *  so the engine still has something to chew on, and mock-mode's sim-shape test keeps
 *  exercising the same events the real hooks would hand it in mock mode. */
function mockAllResolved() {
  mocks.useSleepGoal.mockReturnValue({ goal: mockSleepGoal, isPending: false })
  mocks.useFuelDay.mockReturnValue({ fuel: fuelDay })
  mocks.useSleep.mockReturnValue({ sleepLog, lastNight: sleepLog[sleepLog.length - 1], logSleep: vi.fn() })
  mocks.useTrain.mockReturnValue({
    gymDoneDates: [], completedTodayWorkout: null,
    sport: { sessions: [] },
    workoutPending: false, sportPending: false,
  })
  mocks.useRunning.mockReturnValue({ runSessions: runSessionsMock, runningPending: false })
  mocks.useActivities.mockReturnValue({ data: mockActivities, isPending: false })
  mocks.useCheckins.mockReturnValue({ checkins: initialCheckins })
  mocks.useIntentionDay.mockReturnValue({ data: mockIntentionDay, isPending: false })
  mocks.useRitualDay.mockReturnValue({ data: EMPTY_RITUAL_DAY('2026-08-16'), isPending: false })
  mocks.useHabitDay.mockReturnValue({ habits: mockHabitDay, levelUps: [], mode: 'live' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-17T12:00:00'))
  mockAllResolved()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('useNeeds (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('resolves all 6 rings with finite 0..100 values, not all zero', async () => {
    const now = new Date()
    const { result } = renderHook(() => useNeeds(now), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.isPending).toBe(false))

    expect(result.current.states).toHaveLength(6)
    const keys = result.current.states.map((s) => s.key)
    expect(keys).toEqual(['energia', 'hidratacio', 'pihenes', 'mozgas', 'lelek', 'rend'])

    for (const state of result.current.states) {
      expect(Number.isFinite(state.pct)).toBe(true)
      expect(state.pct).toBeGreaterThanOrEqual(0)
      expect(state.pct).toBeLessThanOrEqual(100)
    }
    // The mock fuel/habit seeds carry real logged meals/ticks, so at least one ring
    // must be above 0 — a fully-zeroed set would mean the adapter dropped every event.
    expect(result.current.states.some((s) => s.pct > 0)).toBe(true)
  })
})

describe('useNeeds (real mode) — composite readiness gate (fix-wave review finding)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('every consumed read resolved -> isPending false', () => {
    const { result } = renderHook(() => useNeeds(new Date()), { wrapper: makeHookWrapper() })
    expect(result.current.isPending).toBe(false)
  })

  test.each([
    ['useSleepGoal', () => mocks.useSleepGoal.mockReturnValue({ goal: mockSleepGoal, isPending: true })],
    ['useActivities', () => mocks.useActivities.mockReturnValue({ data: mockActivities, isPending: true })],
    ['useIntentionDay', () => mocks.useIntentionDay.mockReturnValue({ data: mockIntentionDay, isPending: true })],
    ['useRitualDay', () => mocks.useRitualDay.mockReturnValue({ data: EMPTY_RITUAL_DAY('2026-08-16'), isPending: true })],
    ['useTrain (workoutPending)', () => mocks.useTrain.mockReturnValue({
      gymDoneDates: [], completedTodayWorkout: null, sport: { sessions: [] },
      workoutPending: true, sportPending: false,
    })],
    ['useTrain (sportPending)', () => mocks.useTrain.mockReturnValue({
      gymDoneDates: [], completedTodayWorkout: null, sport: { sessions: [] },
      workoutPending: false, sportPending: true,
    })],
    ['useRunning', () => mocks.useRunning.mockReturnValue({ runSessions: runSessionsMock, runningPending: true })],
  ] as const)('a single source still pending (%s) -> isPending true', (_label, override) => {
    override()
    const { result } = renderHook(() => useNeeds(new Date()), { wrapper: makeHookWrapper() })
    expect(result.current.isPending).toBe(true)
  })

  // useFuelDay/useSleep/useCheckins/useHabitDay don't expose isPending on their public return
  // (see useNeeds.ts's file banner) — the composite doesn't (and can't) key off them: nothing in
  // this file ever sets an isPending flag for them, and the baseline test above still reads
  // false, which is only possible if those four sources never entered the OR chain.
})
