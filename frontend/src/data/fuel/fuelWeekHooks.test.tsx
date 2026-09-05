import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { useFuelWeek, mondayIso, deriveWeekTitle, toMedCycleCells, withDefaultDuration, deriveWeeklyStats } from '@/data/fuel/fuelWeekHooks'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { medicationFixture } from '@/test/fixtures/medication'
import type { FuelWeekDay } from '@/data/fuel/mealApi'
import type { GymScheduleDay, MedicationCycleCell } from '@/data/types'

// --- pure helpers ---

test('mondayIso returns the Monday of the containing week (local)', () => {
  expect(mondayIso(new Date(2026, 6, 4))).toBe('2026-06-29') // Sat Jul 4 -> Mon Jun 29
  expect(mondayIso(new Date(2026, 5, 29))).toBe('2026-06-29') // Monday maps to itself
  expect(mondayIso(new Date(2026, 6, 5))).toBe('2026-06-29') // Sunday still belongs to Mon 29
})

test('deriveWeekTitle formats same-month and cross-month weeks', () => {
  expect(deriveWeekTitle('2026-05-18')).toBe('Máj 18 – 24')
  expect(deriveWeekTitle('2026-06-29')).toBe('Jún 29 – Júl 5')
})

test('toMedCycleCells maps the medication cycle week to strip cells (empty stays empty)', () => {
  const week: MedicationCycleCell[] = [
    { day: 1, phaseKey: 'peak', label: 'Peak', current: false },
    { day: 3, phaseKey: 'stable', label: 'Stabil', current: true },
    { day: 7, phaseKey: 'trough', label: 'Trough', current: false },
  ]
  expect(toMedCycleCells(week)).toEqual([
    { d: 1, label: 'Peak', color: 'var(--medcycle-d1)' },
    { d: 3, label: 'Stable', color: 'var(--medcycle-d3)' },
    { d: 7, label: 'Trough', color: 'var(--medcycle-d7)' },
  ])
  expect(toMedCycleCells([])).toEqual([])
})

test('withDefaultDuration fills only active timed days missing a duration', () => {
  const active: GymScheduleDay = { day: 'Csü', type: 'Pull', time: '18:30', duration: null, active: true }
  const off: GymScheduleDay = { day: 'Szo', type: null, time: null, duration: null, active: false }
  const timed: GymScheduleDay = { day: 'Hét', type: 'Push', time: '07:30', duration: 75, active: true }
  expect(withDefaultDuration(active).duration).toBe(60)
  expect(withDefaultDuration(off).duration).toBeNull()
  expect(withDefaultDuration(timed).duration).toBe(75)
})

test('deriveWeeklyStats averages logged days, counts protein hits, defers adherence', () => {
  const targets = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  const day = (kcal: number, p: number): FuelWeekDay => ({ date: '2026-06-29', targets, consumed: { kcal, p, c: 0, f: 0, water: 0 } })
  const stats = deriveWeeklyStats([day(2800, 225), day(2635, 180), day(0, 0)])
  expect(stats.kcalTarget).toBe(3100)
  expect(stats.kcalAvgFactor).toBeCloseTo(2717.5 / 3100, 5)
  expect(stats.proteinHitDays).toBe(1)
  expect(stats.supplementsAdherence).toBeNull()

  const empty = deriveWeeklyStats([])
  expect(empty.kcalTarget).toBe(0)
  expect(empty.kcalAvgFactor).toBe(0)
  expect(empty.proteinHitDays).toBe(0)
})

// --- useFuelWeek (mock mode) — byte-parity with the Phase-1 seeds ---

describe('useFuelWeek (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('returns the seeds, the demo title and the coach note', () => {
    const { result } = renderHook(() => useFuelWeek(), { wrapper: makeHookWrapper() })
    expect(result.current.title).toBe('Máj 18 – 24')
    // mezo-lwmq: the owner tracks no medication — the mock seed's cycle week is empty, same as
    // real mode's default. See the (real mode) test below for the populated strip.
    expect(result.current.medCycleWeek).toEqual([])
    expect(result.current.gymSchedule).toHaveLength(7)
    expect(result.current.weeklySupplements.length).toBeGreaterThan(0)
    expect(result.current.patterns).toHaveLength(4)
    expect(result.current.weeklyStats.supplementsAdherence).toBe(92)
    expect(result.current.weeklyNote).toContain('középmagas-protein')
  })
})

// --- useFuelWeek (real mode) — composed from Train + medication + the week rollup ---

describe('useFuelWeek (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('composes the live week and returns honest-empty for the deferred surfaces', async () => {
    // The app itself seeds no medication (mezo-lwmq) — an empty cycle would leave the strip
    // empty, so this test overrides the handler with the neutral fixture (cycleDay 3, stable)
    // to exercise the populated-strip branch.
    server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
    const { result } = renderHook(() => useFuelWeek(), { wrapper: makeHookWrapper() })

    // weekly stats resolve from GET /api/fuel/week/{monday} (MSW fixture: 2 logged days)
    await waitFor(() => expect(result.current.weeklyStats.kcalTarget).toBe(3100))
    expect(result.current.weeklyStats.kcalAvgFactor).toBeCloseTo(2717.5 / 3100, 5)
    expect(result.current.weeklyStats.proteinHitDays).toBe(1)
    expect(result.current.weeklyStats.supplementsAdherence).toBeNull()

    // Cycle strip derives from the medication cycle fixture (cycleDay 3, stable)
    await waitFor(() => expect(result.current.medCycleWeek).toHaveLength(7))
    expect(result.current.medCycleWeek[2]).toEqual({ d: 3, label: 'Stable', color: 'var(--medcycle-d3)' })

    // gym week derives from Train (meso fixture: Csü Pull + the 18:30 slot; default duration)
    await waitFor(() => expect(result.current.gymSchedule).toHaveLength(7))
    const csu = result.current.gymSchedule.find(d => d.day === 'Csü')
    expect(csu).toMatchObject({ active: true, time: '18:30', duration: 60 })

    // volleyball comes from Train's sport schedule, not the Today seed
    await waitFor(() => expect(result.current.volleyball.length).toBeGreaterThan(0))
    expect(result.current.volleyball[0].day).toBe('Hét')

    // honest-empty deferred surfaces; date-derived title
    expect(result.current.patterns).toEqual([])
    expect(result.current.weeklySupplements).toEqual([])
    expect(result.current.weeklyNote).toBeNull()
    expect(result.current.title).not.toBe('Máj 18 – 24')
    expect(result.current.title).toBe(deriveWeekTitle(mondayIso()))
  })

  // mezo-cq06 — a skip_sport_slot advice action hides one dated occurrence of a recurring sport
  // slot; the week grid used to keep rendering it regardless. The default sport-schedule fixture's
  // first entry (dayOfWeek 0 = Hét, 18:15) lands on this week's Monday — `mondayIso()` itself.
  it('drops a recurring sport-slot occurrence this week\'s grid honours as skipped', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/sport-slot-skips`, () =>
        HttpResponse.json([{ dayOfWeek: 0, time: '18:15', date: mondayIso() }]),
      ),
    )
    const { result } = renderHook(() => useFuelWeek(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.volleyball.length).toBeGreaterThan(0))
    expect(result.current.volleyball).toHaveLength(4) // 5 fixture − the skipped Hét slot
    expect(result.current.volleyball.some((s) => s.day === 'Hét')).toBe(false)
  })

  it('keeps a recurring sport-slot occurrence whose skip targets a different date', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/sport-slot-skips`, () =>
        HttpResponse.json([{ dayOfWeek: 0, time: '18:15', date: '1999-01-01' }]),
      ),
    )
    const { result } = renderHook(() => useFuelWeek(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.volleyball.length).toBe(5)) // full fixture, untouched
    expect(result.current.volleyball.some((s) => s.day === 'Hét')).toBe(true)
  })
})
