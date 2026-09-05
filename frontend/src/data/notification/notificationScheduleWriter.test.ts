import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildScheduleEntries, useScheduleSnapshotWriter } from '@/data/notification/notificationScheduleWriter'
import { isMockMode } from '@/data/_client/mode'
import type { CheckinSlot, GymSchedule, ProtocolOccurrence, SupplementStashItem } from '@/data/types'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'

const CHECKINS: Pick<CheckinSlot, 'time'>[] = [
  { time: '06:30' }, { time: '10:00' }, { time: '14:00' }, { time: '20:00' },
]

function stackEntry(over: Partial<StackDayEntry> & { pantryItemId: string; name: string }): StackDayEntry {
  return {
    occurrenceId: `occ-${over.pantryItemId}`,
    persistedZone: 'wake',
    dose: null,
    pinned: false,
    placementSource: 'rule',
    reason: null,
    dailyTotalHint: null,
    skippedToday: false,
    displacedToday: false,
    taken: false,
    ...over,
  }
}
function stackSlot(over: Partial<StackDaySlot> & { zone: StackDaySlot['zone']; time: string }): StackDaySlot {
  return {
    label: 'w',
    anchorNote: null,
    entries: [stackEntry({ pantryItemId: 'kreatin-1', name: 'Kreatin', dose: '5g vízben' })],
    ...over,
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

  it('emits one fuel_slot entry per projectStackDay slot, deeplinking to /fuel/stack', () => {
    const entries = buildScheduleEntries([], [stackSlot({ zone: 'pre_workout', time: '17:00' })])
    expect(entries).toHaveLength(1)
    const [entry] = entries
    expect(entry.category).toBe('fuel_slot')
    expect(entry.weekday).toBeNull()
    expect(entry.deeplink).toBe('/fuel/stack')
    expect(entry.source).toBe('projectStackDay')
    expect(entry.time).toBe('17:00')
    expect(entry.title).toContain('Stack')
    expect(entry.body).toContain('Kreatin')
  })

  it('only ever emits checkin/fuel_slot categories — never a backend-native one', () => {
    const entries = buildScheduleEntries(CHECKINS, [
      stackSlot({ zone: 'wake', time: '06:50' }),
      stackSlot({ zone: 'evening', time: '21:00' }),
    ])
    const categories = new Set(entries.map((e) => e.category))
    expect(categories).toEqual(new Set(['checkin', 'fuel_slot']))
  })

  it('every entry title/body stays within the wire limits (120/300 chars) even with many stack items', () => {
    const manyEntries = Array.from({ length: 20 }, (_, i) =>
      stackEntry({
        pantryItemId: `item-${i}`,
        name: `Szuperhosszú-tápkiegészítő-tétel-neve-${i}`,
        dose: '250 mg kapszula, naponta kétszer',
      }),
    )
    const entries = buildScheduleEntries([], [stackSlot({ zone: 'wake', time: '06:50', entries: manyEntries })])
    expect(entries[0].title.length).toBeLessThanOrEqual(120)
    expect((entries[0].body ?? '').length).toBeLessThanOrEqual(300)
  })

  it('an empty selection (no checkins, no fuel slots) yields an empty entry list', () => {
    expect(buildScheduleEntries([], [])).toEqual([])
  })

  // Mirrors buildDayPlan's FuelSlot mapper (mezo-vx9v Task 9): a zone whose every entry is
  // rest-day-skipped is dropped entirely rather than turned into a blank-body push.
  it('a stack slot whose entries are ALL skipped today emits no fuel_slot notification', () => {
    const entries = buildScheduleEntries([], [
      stackSlot({ zone: 'breakfast', time: '06:20', entries: [stackEntry({ pantryItemId: 'pwo', name: 'PWO', skippedToday: true })] }),
    ])
    expect(entries).toEqual([])
  })

  it('a skipped entry is excluded from the body but a slot with at least one live entry still fires', () => {
    const entries = buildScheduleEntries([], [
      stackSlot({
        zone: 'breakfast',
        time: '06:20',
        entries: [
          stackEntry({ pantryItemId: 'pwo', name: 'PWO', skippedToday: true }),
          stackEntry({ pantryItemId: 'whey', name: 'Whey', dose: '20g' }),
        ],
      }),
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0].body).toContain('Whey')
    expect(entries[0].body).not.toContain('PWO')
  })
})

// ── Hook wiring ────────────────────────────────────────────────────────────────────────────
const hooks = vi.hoisted(() => ({
  useStack: vi.fn(),
  useProtocol: vi.fn(),
  useIntakes: vi.fn(),
  useFuelSettings: vi.fn(),
  useSleepGoal: vi.fn(),
  useTrain: vi.fn(),
  useRunning: vi.fn(),
}))
vi.mock('@/data/fuel/stackHooks', () => ({
  useStack: hooks.useStack,
  useProtocol: hooks.useProtocol,
  useIntakes: hooks.useIntakes,
}))
vi.mock('@/data/fuel/fuelSettingsHooks', () => ({
  useFuelSettings: hooks.useFuelSettings,
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
    macros: { kcal: null, p: null, c: null, f: null },
  },
  {
    id: 'aakg-1', name: 'AAKG · L-Arginine', brand: 'Test', type: 'supplement', category: 'test',
    dose: '3g', form: 'por', stock: 30, stockUnit: 'adag', protocol: 'daily', timing: 'pre-workout', taken: false,
    macros: { kcal: null, p: null, c: null, f: null },
  },
]

// kreatin at wake (always renders) + AAKG pinned to pre_workout with an explicit 'skip' rest-day
// fallback — on a training day it anchors to the gym time; on a rest day the zone is absent
// altogether (no pre_workout StackDaySlot at all — projectStackDay never emits it when there are
// no training blocks), which is the behavior the rest-day test below pins.
const OCCURRENCES: ProtocolOccurrence[] = [
  {
    id: 'occ-kreatin', pantryItemId: 'kreatin-1', slotKey: 'wake', dose: null, pinned: false,
    placementSource: 'rule', placementReason: null, restDayFallback: null, dailyTotalHint: null,
  },
  {
    id: 'occ-aakg', pantryItemId: 'aakg-1', slotKey: 'pre_workout', dose: null, pinned: false,
    placementSource: 'rule', placementReason: null, restDayFallback: 'skip', dailyTotalHint: null,
  },
]

const GYM_TODAY: GymSchedule = {
  weeklyTimes: [{ day: 'Szerda', active: true, today: true, time: '17:00', duration: 75, type: 'Láb nap' }],
}

function stubHooks(opts: {
  occurrences?: ProtocolOccurrence[]
  stash?: SupplementStashItem[]
  stackPending?: boolean
  stackError?: boolean
  protocolPending?: boolean
  protocolError?: boolean
  sleepGoalPending?: boolean
  wakeTime?: string
  bedTime?: string
  gymSchedule?: GymSchedule | null
} = {}) {
  hooks.useStack.mockReturnValue({
    stash: opts.stash ?? STASH,
    pending: opts.stackPending ?? false,
    error: opts.stackError ?? false,
  })
  hooks.useProtocol.mockReturnValue({
    protocol: {},
    occurrences: opts.occurrences ?? OCCURRENCES,
    pending: opts.protocolPending ?? false,
    error: opts.protocolError ?? false,
  })
  hooks.useIntakes.mockReturnValue([])
  hooks.useFuelSettings.mockReturnValue({ settings: { mealsPerDay: 4, caffeineCutoff: '14:00' } })
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
  hooks.useIntakes.mockReset()
  hooks.useFuelSettings.mockReset()
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

  // The '(törölt Kamra-item)' poison (mezo-b6q0): the writer used to gate on the sleep-goal read
  // ONLY, so an app open where the (heaviest) pantry query was still unresolved snapshotted every
  // occurrence with projectStackDay's deleted-item fallback name — and AnchorResolver pushes the
  // stored body verbatim until a later open happens to win the race. These four tests pin the
  // gate on every fuel-side read state that yields a not-yet-real stash/occurrence list.
  it('real mode: does not write while the pantry read is still pending — an unresolved (empty) stash must never be snapshotted', async () => {
    if (isMockMode()) return
    stubHooks({ stash: [], stackPending: true })
    putSchedule.mockResolvedValue(undefined)
    renderHook(() => useScheduleSnapshotWriter())
    await new Promise((r) => setTimeout(r, 0))
    expect(putSchedule).not.toHaveBeenCalled()
  })

  it('real mode: does not write while the protocol read is still pending — a checkin-only snapshot would strand stale fuel_slot rows', async () => {
    if (isMockMode()) return
    stubHooks({ occurrences: [], protocolPending: true })
    putSchedule.mockResolvedValue(undefined)
    renderHook(() => useScheduleSnapshotWriter())
    await new Promise((r) => setTimeout(r, 0))
    expect(putSchedule).not.toHaveBeenCalled()
  })

  it('real mode: does not write after a terminally failed pantry read — realEmpty is not real data', async () => {
    if (isMockMode()) return
    stubHooks({ stash: [], stackError: true })
    putSchedule.mockResolvedValue(undefined)
    renderHook(() => useScheduleSnapshotWriter())
    await new Promise((r) => setTimeout(r, 0))
    expect(putSchedule).not.toHaveBeenCalled()
  })

  it('real mode: does not write after a terminally failed protocol read', async () => {
    if (isMockMode()) return
    stubHooks({ occurrences: [], protocolError: true })
    putSchedule.mockResolvedValue(undefined)
    renderHook(() => useScheduleSnapshotWriter())
    await new Promise((r) => setTimeout(r, 0))
    expect(putSchedule).not.toHaveBeenCalled()
  })

  it('real mode: the gate is a wait, not a skip — once the pantry read resolves on a later render, it writes once with real names', async () => {
    if (isMockMode()) return
    stubHooks({ stash: [], stackPending: true })
    putSchedule.mockResolvedValue(undefined)
    const { rerender } = renderHook(() => useScheduleSnapshotWriter())
    await new Promise((r) => setTimeout(r, 0))
    expect(putSchedule).not.toHaveBeenCalled()

    stubHooks() // the pantry query resolved: full stash, pending cleared
    rerender()
    await waitFor(() => expect(putSchedule).toHaveBeenCalledTimes(1))
    const { entries } = putSchedule.mock.calls[0][0]
    const fuelBodies = entries
      .filter((e: { category: string }) => e.category === 'fuel_slot')
      .map((e: { body: string }) => e.body)
    expect(fuelBodies.length).toBeGreaterThan(0)
    for (const body of fuelBodies) expect(body).not.toContain('törölt') // never the tombstone fallback
    expect(fuelBodies.join(' ')).toContain('Kreatin monohidrát')
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

  // Fix round 1 (mezo-h4wp.6.3 review) pinned the real bug: without a canonical pre-workout
  // derivation, the writer put the persisted fuel_slot pre-workout time hours off the real gym
  // time. mezo-vx9v Task 9 moves the derivation onto `projectStackDay` (fed the day's real
  // `blocks`) — this test re-pins the same guarantee on the new path.
  it('real mode: with a gym scheduled today, the persisted pre-workout fuel_slot time is anchored to the gym time, not wake + 60', async () => {
    if (isMockMode()) return
    stubHooks({ gymSchedule: GYM_TODAY, wakeTime: '06:30' })
    putSchedule.mockResolvedValue(undefined)
    renderHook(() => useScheduleSnapshotWriter())
    await waitFor(() => expect(putSchedule).toHaveBeenCalledTimes(1))

    const { entries } = putSchedule.mock.calls[0][0]
    const preWorkout = entries.find((e: { time: string }) => e.time === '16:20')
    expect(preWorkout).toBeDefined() // 17:00 gym − 40min — the canonical PRE_WORKOUT_STACK_LEAD_MIN offset
    expect(preWorkout.title).toContain('edzés előtti')
    expect(entries.some((e: { time: string }) => e.time === '07:30')).toBe(false) // the wake+60 bug this pins
  })

  // Rest-day semantics changed in Task 9: a pre_workout occurrence with restDayFallback:'skip'
  // no longer falls back to a fabricated wake+60 slot — the zone simply doesn't exist today
  // (projectStackDay never emits a pre_workout StackDaySlot when there are no training blocks).
  it('real mode: with no training scheduled today, the pre-workout fuel_slot is absent — a rest-day skip, not a wake+60 fallback', async () => {
    if (isMockMode()) return
    stubHooks({ gymSchedule: null, wakeTime: '06:30' })
    putSchedule.mockResolvedValue(undefined)
    renderHook(() => useScheduleSnapshotWriter())
    await waitFor(() => expect(putSchedule).toHaveBeenCalledTimes(1))

    const { entries } = putSchedule.mock.calls[0][0]
    expect(entries.some((e: { time: string }) => e.time === '07:30')).toBe(false) // no fabricated wake+60 fallback
    expect(entries.some((e: { title: string }) => e.title.includes('edzés előtti'))).toBe(false) // PWO zone is absent
  })
})
