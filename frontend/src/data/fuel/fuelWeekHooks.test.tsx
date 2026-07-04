import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { useFuelWeek, useFuelWeekActions, mondayIso, deriveWeekTitle, toRetaCells, withDefaultDuration, gymDaysToSlots, deriveWeeklyStats } from '@/data/fuel/fuelWeekHooks'
import { trainApi } from '@/data/train/trainApi'
import { makeHookWrapper } from '@/test/queryWrapper'
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

test('toRetaCells maps the medication cycle week to strip cells (empty stays empty)', () => {
  const week: MedicationCycleCell[] = [
    { day: 1, phaseKey: 'peak', label: 'Peak', current: false },
    { day: 3, phaseKey: 'stable', label: 'Stabil', current: true },
    { day: 7, phaseKey: 'trough', label: 'Trough', current: false },
  ]
  expect(toRetaCells(week)).toEqual([
    { d: 1, label: 'Peak', color: 'var(--reta-d1)' },
    { d: 3, label: 'Stable', color: 'var(--reta-d3)' },
    { d: 7, label: 'Trough', color: 'var(--reta-d7)' },
  ])
  expect(toRetaCells([])).toEqual([])
})

test('withDefaultDuration fills only active timed days missing a duration', () => {
  const active: GymScheduleDay = { day: 'Csü', type: 'Pull', time: '18:30', duration: null, active: true }
  const off: GymScheduleDay = { day: 'Szo', type: null, time: null, duration: null, active: false }
  const timed: GymScheduleDay = { day: 'Hét', type: 'Push', time: '07:30', duration: 75, active: true }
  expect(withDefaultDuration(active).duration).toBe(60)
  expect(withDefaultDuration(off).duration).toBeNull()
  expect(withDefaultDuration(timed).duration).toBe(75)
})

test('gymDaysToSlots keeps only active days with a time, mapped to DAY_ORDER indices', () => {
  const days: GymScheduleDay[] = [
    { day: 'Hét', type: 'Push', time: '07:30', duration: 75, active: true },
    { day: 'Kedd', type: 'Legs', time: null, duration: null, active: true }, // no time -> dropped
    { day: 'Sze', type: 'Pull', time: '07:30', duration: 75, active: false }, // off -> dropped
    { day: 'Vas', type: null, time: '18:00', duration: null, active: true },
    { day: '???', type: null, time: '18:00', duration: null, active: true }, // unknown label -> dropped
  ]
  expect(gymDaysToSlots(days)).toEqual([
    { dayOfWeek: 0, time: '07:30' },
    { dayOfWeek: 6, time: '18:00' },
  ])
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
    expect(result.current.retaWeek).toHaveLength(7)
    expect(result.current.gymSchedule).toHaveLength(7)
    expect(result.current.weeklySupplements.length).toBeGreaterThan(0)
    expect(result.current.patterns).toHaveLength(4)
    expect(result.current.weeklyStats.supplementsAdherence).toBe(92)
    expect(result.current.weeklyNote).toContain('középmagas-protein')
  })

  it('saveGymSchedule does not hit the API (Train mock no-op)', () => {
    const spy = vi.spyOn(trainApi, 'replaceGymSchedule')
    const { result } = renderHook(() => useFuelWeekActions(), { wrapper: makeHookWrapper() })
    result.current.saveGymSchedule([{ day: 'Hét', type: 'Push', time: '07:30', duration: 75, active: true }])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// --- useFuelWeek (real mode) — composed from Train + medication + the week rollup ---

describe('useFuelWeek (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('composes the live week and returns honest-empty for the deferred surfaces', async () => {
    const { result } = renderHook(() => useFuelWeek(), { wrapper: makeHookWrapper() })

    // weekly stats resolve from GET /api/fuel/week/{monday} (MSW fixture: 2 logged days)
    await waitFor(() => expect(result.current.weeklyStats.kcalTarget).toBe(3100))
    expect(result.current.weeklyStats.kcalAvgFactor).toBeCloseTo(2717.5 / 3100, 5)
    expect(result.current.weeklyStats.proteinHitDays).toBe(1)
    expect(result.current.weeklyStats.supplementsAdherence).toBeNull()

    // Reta strip derives from the medication cycle fixture (retaDay 3, stable)
    await waitFor(() => expect(result.current.retaWeek).toHaveLength(7))
    expect(result.current.retaWeek[2]).toEqual({ d: 3, label: 'Stable', color: 'var(--reta-d3)' })

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

  it('saveGymSchedule writes through to PUT /api/train/gym-schedule with mapped slots', async () => {
    const spy = vi.spyOn(trainApi, 'replaceGymSchedule')
    const { result } = renderHook(() => useFuelWeekActions(), { wrapper: makeHookWrapper() })
    result.current.saveGymSchedule([
      { day: 'Hét', type: 'Push', time: '07:30', duration: 75, active: true },
      { day: 'Szo', type: null, time: null, duration: null, active: false },
    ])
    await waitFor(() => expect(spy).toHaveBeenCalledWith([{ dayOfWeek: 0, time: '07:30' }]))
    spy.mockRestore()
  })
})
