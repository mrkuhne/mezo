import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildScheduleEntries, useScheduleSnapshotWriter } from '@/data/notification/notificationScheduleWriter'
import { isMockMode } from '@/data/_client/mode'
import type { CheckinSlot, GymSchedule, ProtocolSlotData, SupplementStashItem } from '@/data/types'

const CHECKINS: Pick<CheckinSlot, 'time'>[] = [
  { time: '06:30' }, { time: '10:00' }, { time: '14:00' }, { time: '20:00' },
]

function fuelSlot(overrides: Partial<ProtocolSlotData> = {}): ProtocolSlotData {
  return {
    time: '06:50',
    window: 'wake',
    kind: 'morning',
    kindColor: 'var(--text-secondary)',
    items: [{ refId: 'kreatin-1', name: 'Kreatin', dose: '5g vízben', color: 'var(--coral)' }],
    reasoning: 'reasoning text',
    primary: false,
    ...overrides,
  }
}

describe('buildScheduleEntries (pure)', () => {
  it('emits one checkin entry per canonical check-in time, every day (weekday null)', () => {
    const entries = buildScheduleEntries(CHECKINS, [])
    const checkinEntries = entries.filter((e) => e.category === 'checkin')
    expect(checkinEntries).toHaveLength(4)
    expect(checkinEntries.map((e) => e.time)).toEqual(['06:30', '10:00', '14:00', '20:00'])
    for (const e of checkinEntries) {
      expect(e.weekday).toBeNull()
      expect(e.deeplink).toBe(`/today?checkin=${e.time}`)
      expect(e.source).toBe('checkinSlots')
      expect(e.time).toMatch(/^\d{2}:\d{2}$/)
    }
  })

  // push-sw.js uses `data.url` as the notification `tag`, and a shared tag REPLACES an already
  // shown notification — with a bare '/today' on all four slots, the 10:00 check-in silently
  // wiped an undismissed 06:30 one (and collided with briefing/wind_down/midday too).
  it('gives every check-in slot a DISTINCT deeplink, so the service-worker tag cannot collapse them', () => {
    const entries = buildScheduleEntries(CHECKINS, [])
    const deeplinks = entries.filter((e) => e.category === 'checkin').map((e) => e.deeplink)
    expect(new Set(deeplinks).size).toBe(CHECKINS.length)
    expect(deeplinks).toEqual(['/today?checkin=06:30', '/today?checkin=10:00', '/today?checkin=14:00', '/today?checkin=20:00'])
    for (const link of deeplinks) expect(link.startsWith('/today')).toBe(true) // still the same route
  })

  it('emits one fuel_slot entry per buildProtocol slot, deeplinking to /fuel/stack', () => {
    const entries = buildScheduleEntries([], [fuelSlot({ time: '17:00', window: 'T-40min' })])
    expect(entries).toHaveLength(1)
    const [entry] = entries
    expect(entry.category).toBe('fuel_slot')
    expect(entry.weekday).toBeNull()
    expect(entry.deeplink).toBe('/fuel/stack')
    expect(entry.source).toBe('buildProtocol')
    expect(entry.time).toBe('17:00')
    expect(entry.title).toContain('Stack')
    expect(entry.body).toContain('Kreatin')
  })

  it('only ever emits checkin/fuel_slot categories — never a backend-native one', () => {
    const entries = buildScheduleEntries(CHECKINS, [fuelSlot(), fuelSlot({ time: '21:00', window: 'T-2h sleep' })])
    const categories = new Set(entries.map((e) => e.category))
    expect(categories).toEqual(new Set(['checkin', 'fuel_slot']))
  })

  it('every entry title/body stays within the wire limits (120/300 chars) even with many stack items', () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      refId: `item-${i}`, name: `Szuperhosszú-tápkiegészítő-tétel-neve-${i}`, dose: '250 mg kapszula, naponta kétszer', color: 'var(--coral)',
    }))
    const entries = buildScheduleEntries([], [fuelSlot({ items: manyItems })])
    expect(entries[0].title.length).toBeLessThanOrEqual(120)
    expect((entries[0].body ?? '').length).toBeLessThanOrEqual(300)
  })

  it('an empty selection (no checkins, no fuel slots) yields an empty entry list', () => {
    expect(buildScheduleEntries([], [])).toEqual([])
  })

  it('a fuel slot with no items still gets an honest, non-empty body (never a blank push)', () => {
    const entries = buildScheduleEntries([], [fuelSlot({ items: [] })])
    expect(entries[0].body).toBeTruthy()
  })
})

// ── Hook wiring ────────────────────────────────────────────────────────────────────────────
const hooks = vi.hoisted(() => ({
  useStack: vi.fn(),
  useProtocol: vi.fn(),
  useSleepGoal: vi.fn(),
  useTrain: vi.fn(),
  useRunning: vi.fn(),
}))
vi.mock('@/data/fuel/stackHooks', () => ({
  useStack: hooks.useStack,
  useProtocol: hooks.useProtocol,
}))
vi.mock('@/data/me/sleepHooks', () => ({
  useSleepGoal: hooks.useSleepGoal,
}))
vi.mock('@/data/train/trainHooks', () => ({
  useTrain: hooks.useTrain,
}))
vi.mock('@/data/train/runningHooks', () => ({
  useRunning: hooks.useRunning,
}))

const putSchedule = vi.hoisted(() => vi.fn())
vi.mock('@/data/notification/notificationApi', () => ({
  notificationApi: { putSchedule },
}))

const STASH: SupplementStashItem[] = [
  {
    id: 'kreatin-1', name: 'Kreatin monohidrát', brand: 'Test', type: 'supplement', category: 'test',
    dose: '5g', form: 'por', stock: 30, stockUnit: 'adag', protocol: 'daily', timing: 'wake', taken: false,
  },
  // AAKG matches buildProtocol's pre-workout basket (find('aakg')) — without an item in that
  // basket, buildProtocol never emits a 'pre-workout' slot at all, so the gym-anchored-time
  // pinning tests below need this to have anything to assert on.
  {
    id: 'aakg-1', name: 'AAKG · L-Arginine', brand: 'Test', type: 'supplement', category: 'test',
    dose: '3g', form: 'por', stock: 30, stockUnit: 'adag', protocol: 'daily', timing: 'pre-workout', taken: false,
  },
]

const GYM_TODAY: GymSchedule = {
  weeklyTimes: [{ day: 'Szerda', active: true, today: true, time: '17:00', duration: 75, type: 'Láb nap' }],
}

function stubHooks(opts: {
  selectedIds?: string[] | null
  sleepGoalPending?: boolean
  wakeTime?: string
  bedTime?: string
  gymSchedule?: GymSchedule | null
} = {}) {
  hooks.useStack.mockReturnValue({ stash: STASH })
  hooks.useProtocol.mockReturnValue({ protocol: {}, selectedIds: opts.selectedIds ?? ['kreatin-1', 'aakg-1'] })
  hooks.useSleepGoal.mockReturnValue({
    goal: { wakeTime: opts.wakeTime ?? '06:30', bedTime: opts.bedTime ?? '22:30' },
    isPending: opts.sleepGoalPending ?? false,
  })
  hooks.useTrain.mockReturnValue({ gymSchedule: opts.gymSchedule ?? null, sport: { schedule: null } })
  hooks.useRunning.mockReturnValue({ activeRunningBlock: null })
}

afterEach(() => {
  vi.unstubAllEnvs()
  putSchedule.mockReset()
  hooks.useStack.mockReset()
  hooks.useProtocol.mockReset()
  hooks.useSleepGoal.mockReset()
  hooks.useTrain.mockReset()
  hooks.useRunning.mockReset()
})

describe('useScheduleSnapshotWriter', () => {
  it('mock mode never calls the network, even once real data is "ready"', async () => {
    if (!isMockMode()) return
    stubHooks()
    putSchedule.mockResolvedValue(undefined)
    renderHook(() => useScheduleSnapshotWriter())
    await new Promise((r) => setTimeout(r, 0))
    expect(putSchedule).not.toHaveBeenCalled()
  })

  it('real mode: does not write while the sleep-goal read is still pending', async () => {
    if (isMockMode()) return
    stubHooks({ sleepGoalPending: true })
    putSchedule.mockResolvedValue(undefined)
    renderHook(() => useScheduleSnapshotWriter())
    await new Promise((r) => setTimeout(r, 0))
    expect(putSchedule).not.toHaveBeenCalled()
  })

  it('real mode: writes exactly once, with categories derived from the entries, once data is ready', async () => {
    if (isMockMode()) return
    stubHooks()
    putSchedule.mockResolvedValue(undefined)
    const { rerender } = renderHook(() => useScheduleSnapshotWriter())
    await waitFor(() => expect(putSchedule).toHaveBeenCalledTimes(1))

    const call = putSchedule.mock.calls[0][0]
    expect(new Set(call.categories)).toEqual(new Set(['checkin', 'fuel_slot']))
    // Every listed category is backed by at least one entry naming it — never the other way
    // around (an entry naming a category absent from the list is the caller-misuse path).
    for (const entry of call.entries) expect(call.categories).toContain(entry.category)

    // Further re-renders (e.g. an unrelated prop change) must not write a second time.
    rerender()
    rerender()
    await new Promise((r) => setTimeout(r, 0))
    expect(putSchedule).toHaveBeenCalledTimes(1)
  })

  it('real mode: a rejected PUT is swallowed — the hook never throws and does not retry mid-session', async () => {
    if (isMockMode()) return
    stubHooks()
    putSchedule.mockRejectedValue(new Error('network down'))
    expect(() => renderHook(() => useScheduleSnapshotWriter())).not.toThrow()
    await waitFor(() => expect(putSchedule).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 0))
    expect(putSchedule).toHaveBeenCalledTimes(1)
  })

  // Fix round 1 (mezo-h4wp.6.3 review): pins the real bug — without deriveProtocolAnchors, the
  // writer called buildProtocol with only {wake, bedtime}, so the persisted fuel_slot pre-workout
  // time silently used the wake+60 rest-day fallback on every training day.
  it('real mode: with a gym scheduled today, the persisted pre-workout fuel_slot time is anchored to the gym time, not wake + 60', async () => {
    if (isMockMode()) return
    stubHooks({ gymSchedule: GYM_TODAY, wakeTime: '06:30' })
    putSchedule.mockResolvedValue(undefined)
    renderHook(() => useScheduleSnapshotWriter())
    await waitFor(() => expect(putSchedule).toHaveBeenCalledTimes(1))

    const { entries } = putSchedule.mock.calls[0][0]
    const preWorkout = entries.find((e: { time: string }) => e.time === '16:20')
    expect(preWorkout).toBeDefined() // 17:00 gym − 40min — the canonical deriveProtocolAnchors offset
    expect(entries.some((e: { time: string }) => e.time === '07:30')).toBe(false) // the wake+60 bug this pins
  })

  it('real mode: with no training scheduled today, the fuel_slot pre-workout time falls back exactly as buildProtocol intends', async () => {
    if (isMockMode()) return
    stubHooks({ gymSchedule: null, wakeTime: '06:30' })
    putSchedule.mockResolvedValue(undefined)
    renderHook(() => useScheduleSnapshotWriter())
    await waitFor(() => expect(putSchedule).toHaveBeenCalledTimes(1))

    const { entries } = putSchedule.mock.calls[0][0]
    // No gym today → deriveProtocolAnchors leaves preWorkout undefined → buildProtocol's own
    // documented rest-day fallback (wake + 60) applies, honestly, not a bug.
    expect(entries.some((e: { time: string }) => e.time === '07:30')).toBe(true)
  })
})
