import { describe, expect, test } from 'vitest'
import {
  buildTodayItems, isFillableSlot, itemsForFace, openCountByFace,
} from '@/features/today/logic/todayItems'
import type { CheckinSlot, DailyQuest, FuelSlot, HabitItem, RitualDay } from '@/data/types'

const GOAL = { wakeTime: '06:30', bedTime: '22:30' }

const quest = (over: Partial<DailyQuest> = {}): DailyQuest => ({
  id: 'q1', questDate: '2026-05-21', slot: 'BODY', skillKey: 'recovery',
  title: 'Olvass ma legalább 10 percet', why: '', targetLabel: '', metric: 'reading_minutes',
  xp: 15, status: 'offered', completionMode: 'DERIVED', ...over,
})

const habit = (over: Partial<HabitItem> = {}): HabitItem => ({
  key: 'morning_sunlight', chain: 'MORNING', position: 2, title: 'Reggeli napfény',
  why: '', anchorCopy: 'ébredés után', mode: 'MANUAL', status: 'pending', xp: 5, ...over,
})

const EMPTY = { quests: [], habits: [], checkins: [], fuelSlots: [], sessions: [], ritual: null, goal: GOAL }

describe('buildTodayItems — quests', () => {
  test('an offered quest is a day-wide open item on every face', () => {
    const items = buildTodayItems({ ...EMPTY, quests: [quest()] })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ source: 'quest', face: 'all', status: 'open', group: 'Napi küldetések' })
    expect(itemsForFace(items, 'reggel').open).toHaveLength(1)
    expect(itemsForFace(items, 'este').open).toHaveLength(1)
  })

  test('a quest row carries questAction\'s OWN label, not a flat „Naplózz"', () => {
    // The I4 regression: every pill read „Naplózz" — a word that everywhere else on this screen
    // means „open a log surface". On `water_target` that made a silent, immediate 250 ml write
    // indistinguishable from a navigation.
    const items = buildTodayItems({
      ...EMPTY,
      quests: [
        quest({ id: 'w', metric: 'water_target' }),
        quest({ id: 's', metric: 'sleep_target' }),
        quest({ id: 'c', metric: 'checkin_full' }),
        quest({ id: 'a', metric: 'reading_minutes', completionMode: 'ACTIVITY' }),
      ],
    })
    expect(items.map(i => i.action?.label)).toEqual(['+250 ml', 'Alvás', 'Check-in', 'Naplózz'])
  })

  test('an unmapped metric still gets a label — TodayPage strips the whole action anyway', () => {
    const items = buildTodayItems({ ...EMPTY, quests: [quest({ metric: 'intention_focus_set' })] })
    expect(items[0].action?.label).toBe('Naplózz')
  })

  test('a completed quest is done, an expired quest is missed', () => {
    const items = buildTodayItems({
      ...EMPTY,
      quests: [quest({ id: 'a', status: 'completed' }), quest({ id: 'b', status: 'expired' })],
    })
    expect(items.find(i => i.id.endsWith('a'))?.status).toBe('done')
    expect(items.find(i => i.id.endsWith('b'))?.status).toBe('missed')
  })
})

describe('buildTodayItems — habits', () => {
  test('a MORNING habit lands on reggel and an EVENING habit on este', () => {
    const items = buildTodayItems({
      ...EMPTY,
      habits: [habit(), habit({ key: 'wind_down', chain: 'EVENING', title: 'Wind-down' })],
    })
    expect(items.find(i => i.title === 'Reggeli napfény')?.face).toBe('reggel')
    expect(items.find(i => i.title === 'Wind-down')?.face).toBe('este')
  })

  test('habit status maps 1:1 onto item status', () => {
    const items = buildTodayItems({
      ...EMPTY,
      habits: [habit({ key: 'a', status: 'done' }), habit({ key: 'b', status: 'missed' }), habit({ key: 'c', status: 'pending' })],
    })
    expect(items.map(i => i.status).sort()).toEqual(['done', 'missed', 'open'])
  })

  test('the group label names the chain', () => {
    const items = buildTodayItems({ ...EMPTY, habits: [habit(), habit({ key: 'x', chain: 'EVENING' })] })
    expect(items.find(i => i.face === 'reggel')?.group).toBe('Reggeli rutin')
    expect(items.find(i => i.face === 'este')?.group).toBe('Esti rutin')
  })

  test('a habit in an unknown/custom chain does not throw and produces no row (mezo-n5e9.1 review finding 4)', () => {
    // `HabitItem.chain` widened to a plain string (ADR 0019, `HabitChainAdmin`'s admin API,
    // mezo-n5e9.2) — a custom `chain_xxxx` row is reachable here at runtime with no cast needed.
    const custom = habit({ key: 'custom_deadbeef', chain: 'chain_abc123' })
    expect(() => buildTodayItems({ ...EMPTY, habits: [custom] })).not.toThrow()
    const items = buildTodayItems({ ...EMPTY, habits: [custom] })
    expect(items).toHaveLength(0)
  })
})

describe('buildTodayItems — dedup', () => {
  test.each([
    ['morning_weigh_in', 'weight_logged'],
    ['morning_workout', 'gym_session_done'],
    ['wake_on_time', 'sleep_target'],
    ['protein_breakfast', 'protein_target'],
  ])('a %s habit absorbs the %s quest — one row, both rewards', (key, metric) => {
    const items = buildTodayItems({
      ...EMPTY,
      habits: [habit({ key, title: 'Reggeli súlymérés', xp: 10 })],
      quests: [quest({ metric, xp: 15 })],
    })
    expect(items).toHaveLength(1)
    expect(items[0].source).toBe('habit')
    expect(items[0].xp).toBe(25)
  })

  test('an unpaired quest and an unpaired habit both survive', () => {
    const items = buildTodayItems({
      ...EMPTY,
      habits: [habit({ key: 'morning_sunlight' })],
      quests: [quest({ metric: 'water_target' })],
    })
    expect(items).toHaveLength(2)
  })

  test('a gym_session_done quest is dropped when the day already has a session item', () => {
    const items = buildTodayItems({
      ...EMPTY,
      quests: [quest({ metric: 'gym_session_done' })],
      sessions: [{ id: 's1', tone: 'gym', emoji: '🏋️', tag: 'GYM', title: 'Pull Day', time: '17:00', facts: [], logged: false }],
    })
    expect(items.filter(i => i.source === 'quest')).toHaveLength(0)
    expect(items.filter(i => i.source === 'session')).toHaveLength(1)
  })
})

describe('itemsForFace / openCountByFace', () => {
  test('done items are partitioned out of the open list', () => {
    const items = buildTodayItems({
      ...EMPTY,
      habits: [habit({ key: 'a', status: 'done' }), habit({ key: 'b', status: 'pending' })],
    })
    const { open, done } = itemsForFace(items, 'reggel')
    expect(open).toHaveLength(1)
    expect(done).toHaveLength(1)
  })

  test('a missed item counts as neither open nor done', () => {
    const items = buildTodayItems({ ...EMPTY, habits: [habit({ key: 'a', status: 'missed' })] })
    const { open, done } = itemsForFace(items, 'reggel')
    expect(open).toHaveLength(0)
    expect(done).toHaveLength(0)
  })

  test('day-wide open items are counted on every face', () => {
    const items = buildTodayItems({ ...EMPTY, quests: [quest()], habits: [habit()] })
    expect(openCountByFace(items)).toEqual({ reggel: 2, nap: 1, este: 1 })
  })
})

const slot = (time: string, state: CheckinSlot['state']): CheckinSlot =>
  ({ time, state, values: null, note: null })

describe('buildTodayItems — check-ins', () => {
  test('each slot lands on the face its clock time belongs to', () => {
    const items = buildTodayItems({
      ...EMPTY,
      checkins: [slot('06:30', 'done'), slot('10:00', 'now'), slot('14:00', 'pending'), slot('20:00', 'pending')],
    })
    const byTime = Object.fromEntries(items.map(i => [i.time, i.face]))
    expect(byTime).toEqual({ '06:30': 'reggel', '10:00': 'reggel', '14:00': 'nap', '20:00': 'este' })
  })

  test('the slot index survives onto the action so the sheet can be opened', () => {
    const items = buildTodayItems({ ...EMPTY, checkins: [slot('06:30', 'done'), slot('14:00', 'now')] })
    const nap = items.find(i => i.time === '14:00')
    expect(nap?.action).toEqual({ kind: 'checkin', slotIdx: 1, label: 'Koppints' })
  })

  test('a done slot is done — and a SKIPPED slot stays OPEN so it can still be filled', () => {
    // The C1 regression: `skipped → missed` made the row invisible everywhere (nothing on the
    // screen renders a `missed` item), so from 10:00 onward an unfilled morning slot could not
    // be reached from any surface — while `CheckInSheet` posts `state: 'done'` and would have
    // backfilled it happily. Mock's `initialCheckins` never yields `skipped`, which is why
    // 1981 tests and six goldens missed it; this fixture is the one that does.
    const items = buildTodayItems({ ...EMPTY, checkins: [slot('06:30', 'done'), slot('10:00', 'skipped')] })
    expect(items.map(i => i.status)).toEqual(['done', 'open'])
    expect(itemsForFace(items, 'reggel').open.map(i => i.id)).toContain('checkin:10:00')
  })

  test('a skipped slot never pretends it was on time — past tense, „elmaradt", a Pótold pill', () => {
    const items = buildTodayItems({ ...EMPTY, checkins: [slot('06:30', 'done'), slot('10:00', 'skipped')] })
    const late = items[1]
    expect(late.title).toBe('Hogy voltál?')
    expect(late.subtitle).toBe('10:00 · elmaradt')
    expect(late.action).toEqual({ kind: 'checkin', slotIdx: 1, label: 'Pótold' })
    // …while a slot whose window is still open keeps the present-tense invitation
    expect(items[0].title).toBe('Hogy vagy?')
  })

  test('isFillableSlot — everything but an already recorded slot', () => {
    expect([slot('06:30', 'done'), slot('10:00', 'skipped'), slot('14:00', 'now'), slot('20:00', 'pending')]
      .map(isFillableSlot)).toEqual([false, true, true, true])
  })
})

describe('buildTodayItems — fuel slots', () => {
  const fuel = (time: string, state: FuelSlot['state'], label: string): FuelSlot =>
    ({ time, kind: 'meal', label, state })

  test('slots bucket by their own clock time and carry the meal name when present', () => {
    const items = buildTodayItems({
      ...EMPTY,
      fuelSlots: [fuel('08:00', 'done', 'Reggeli'), fuel('21:15', 'pending', 'Esti stack')],
    })
    expect(items.find(i => i.time === '08:00')).toMatchObject({ face: 'reggel', status: 'done', group: 'Fuel' })
    expect(items.find(i => i.time === '21:15')).toMatchObject({ face: 'este', status: 'open' })
  })

  test('a missed fuel slot is missed, not open', () => {
    const items = buildTodayItems({ ...EMPTY, fuelSlots: [fuel('13:00', 'missed', 'Ebéd')] })
    expect(items[0].status).toBe('missed')
  })

  test('the LIVE slot is marked MOST — `now` folds into `open`, so the copy carries it', () => {
    const items = buildTodayItems({
      ...EMPTY,
      fuelSlots: [fuel('13:00', 'now', 'Ebéd'), fuel('16:00', 'pending', 'Uzsonna')],
    })
    const [live, later] = items
    expect(live.status).toBe('open')
    expect(live.subtitle).toBe('MOST')
    expect(later.subtitle).toBeNull()
  })

  test('MOST joins the meal name rather than replacing it', () => {
    const items = buildTodayItems({
      ...EMPTY,
      fuelSlots: [{ time: '13:00', kind: 'meal', label: 'Ebéd', state: 'now', mealName: 'Csirke rizzsel' }],
    })
    expect(items[0]).toMatchObject({ title: 'Csirke rizzsel', subtitle: 'MOST · Ebéd' })
  })
})

describe('buildTodayItems — ritual', () => {
  const RITUAL: RitualDay = {
    date: '2026-05-21', closed: false, closedAt: null,
    window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
  }

  test('an unclosed ritual is an open evening item anchored to opensAt', () => {
    const items = buildTodayItems({ ...EMPTY, ritual: RITUAL })
    expect(items[0]).toMatchObject({
      source: 'ritual', face: 'este', status: 'open', time: '21:15', group: 'Napzárás',
    })
    expect(items[0].action).toEqual({ kind: 'nav', to: '/ritual', label: 'Zárjuk le' })
  })

  test('a closed ritual is done', () => {
    const items = buildTodayItems({ ...EMPTY, ritual: { ...RITUAL, closed: true, closedAt: '2026-05-21T21:40:00Z' } })
    expect(items[0].status).toBe('done')
  })
})
