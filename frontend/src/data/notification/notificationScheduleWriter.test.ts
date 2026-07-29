import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildScheduleEntries, useScheduleSnapshotWriter } from '@/data/notification/notificationScheduleWriter'
import { isMockMode } from '@/data/_client/mode'
import type { CheckinSlot, ProtocolSlotData, SupplementStashItem } from '@/data/types'

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
      expect(e.deeplink).toBe('/today')
      expect(e.source).toBe('checkinSlots')
      expect(e.time).toMatch(/^\d{2}:\d{2}$/)
    }
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
}))
vi.mock('@/data/fuel/stackHooks', () => ({
  useStack: hooks.useStack,
  useProtocol: hooks.useProtocol,
}))
vi.mock('@/data/me/sleepHooks', () => ({
  useSleepGoal: hooks.useSleepGoal,
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
]

function stubHooks(opts: {
  selectedIds?: string[] | null
  sleepGoalPending?: boolean
  wakeTime?: string
  bedTime?: string
} = {}) {
  hooks.useStack.mockReturnValue({ stash: STASH })
  hooks.useProtocol.mockReturnValue({ protocol: {}, selectedIds: opts.selectedIds ?? ['kreatin-1'] })
  hooks.useSleepGoal.mockReturnValue({
    goal: { wakeTime: opts.wakeTime ?? '06:30', bedTime: opts.bedTime ?? '22:30' },
    isPending: opts.sleepGoalPending ?? false,
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  putSchedule.mockReset()
  hooks.useStack.mockReset()
  hooks.useProtocol.mockReset()
  hooks.useSleepGoal.mockReset()
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
})
