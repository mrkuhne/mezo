import { describe, expect, test } from 'vitest'
import { buildNeedsEvents, ringsOf, type RawNeedsData } from '@/features/today/logic/needsInputs'
import type { NeedState } from '@/features/today/logic/needs'
import type { FuelDay, FuelMeal, HabitItem, IntentionDay, RitualDay } from '@/data/types'

const TODAY = '2026-08-17'
const YESTERDAY = '2026-08-16'
const WAKE = '07:00'
const BED = '23:00'
const NOW = new Date(`${TODAY}T20:00:00`)

const emptyFuel = (): FuelDay => ({
  targets: { kcal: 0, p: 0, c: 0, f: 0, water: 0 },
  consumed: { kcal: 0, p: 0, c: 0, f: 0, water: 0 },
  meals: [],
  pacing: { msg: '' },
  micronutrients: [],
  supplements: [],
})

const fuelWithWater = (ml: number): FuelDay => ({ ...emptyFuel(), consumed: { ...emptyFuel().consumed, water: ml } })

const meal = (overrides: Partial<FuelMeal>): FuelMeal => ({
  id: 'm1', slot: 'Ebéd', title: '', score: null,
  kcal: 0, p: 0, c: 0, f: 0,
  mealItems: [], items: [], tags: [],
  loggedAt: `${TODAY}T12:00:00`, mealDate: TODAY,
  ...overrides,
})

const emptyIntention = (date: string): IntentionDay => ({ date, creed: null, foci: [], reflection: null, focusCap: 3 })
const emptyRitual = (date: string): RitualDay => ({
  date, closed: false, closedAt: null, reflectionText: null, window: { opensAt: '', prepStartsAt: '', bedTime: BED },
})

const habit = (overrides: Partial<HabitItem>): HabitItem => ({
  key: 'h1', chain: 'MORNING', position: 0, title: 'Ivás', why: '', anchorCopy: '',
  mode: 'MANUAL', status: 'pending', xp: 10,
  ...overrides,
})

/** A fully-populated, source-empty RawNeedsData — tests override just the field(s) under test. */
const baseRaw = (): RawNeedsData => ({
  now: NOW,
  todayIso: TODAY,
  yesterdayIso: YESTERDAY,
  wakeTime: WAKE,
  bedTime: BED,
  fuelToday: emptyFuel(),
  fuelYesterday: emptyFuel(),
  sleepLog: [],
  goalMinutes: 480,
  gymDoneDates: [],
  completedTodayWorkout: null,
  sportSessions: [],
  runSessions: [],
  activitiesToday: [],
  activitiesYesterday: [],
  checkinsToday: [],
  intentionToday: emptyIntention(TODAY),
  intentionYesterday: emptyIntention(YESTERDAY),
  ritualYesterday: emptyRitual(YESTERDAY),
  habitsToday: [],
  habitsYesterday: [],
})

describe('buildNeedsEvents — 🍽️ energia (meals)', () => {
  test('a "Snack" slot classifies as +snack (15)', () => {
    const raw = { ...baseRaw(), fuelToday: { ...emptyFuel(), meals: [meal({ slot: 'Snack', loggedAt: `${TODAY}T15:00:00` })] } }
    const events = buildNeedsEvents(raw).energia
    expect(events).toEqual([
      { at: new Date(`${TODAY}T15:00:00`), kind: 'add', amount: 15, label: 'Snack' },
    ])
  })

  test('a "Reggeli · 09:15 · post-workout" slot classifies as +mainMeal (40), label is the first word', () => {
    const raw = {
      ...baseRaw(),
      fuelToday: { ...emptyFuel(), meals: [meal({ slot: 'Reggeli · 09:15 · post-workout', loggedAt: `${TODAY}T09:15:00` })] },
    }
    const events = buildNeedsEvents(raw).energia
    expect(events).toEqual([
      { at: new Date(`${TODAY}T09:15:00`), kind: 'add', amount: 40, label: 'Reggeli' },
    ])
  })

  test('meals from both today and yesterday are included', () => {
    const raw = {
      ...baseRaw(),
      fuelToday: { ...emptyFuel(), meals: [meal({ slot: 'Ebéd', loggedAt: `${TODAY}T12:00:00` })] },
      fuelYesterday: { ...emptyFuel(), meals: [meal({ slot: 'Vacsora', loggedAt: `${YESTERDAY}T19:00:00` })] },
    }
    expect(buildNeedsEvents(raw).energia).toHaveLength(2)
  })

  test('no meals on either day → []', () => {
    expect(buildNeedsEvents(baseRaw()).energia).toEqual([])
  })
})

describe('buildNeedsEvents — 💧 hidratacio (water)', () => {
  test('1240ml → 4 events, evenly spaced between wake and now, never on a boundary', () => {
    const raw = { ...baseRaw(), fuelToday: fuelWithWater(1240) }
    const events = buildNeedsEvents(raw).hidratacio
    expect(events).toHaveLength(4)
    const wake = new Date(`${TODAY}T${WAKE}:00`).getTime()
    const now = NOW.getTime()
    const span = now - wake
    events.forEach((e, i) => {
      const expectedAt = wake + ((i + 1) * span) / 5
      expect(e.at.getTime()).toBe(expectedAt)
      expect(e.at.getTime()).toBeGreaterThan(wake)
      expect(e.at.getTime()).toBeLessThan(now)
      expect(e.kind).toBe('add')
      expect(e.amount).toBe(12)
      expect(e.label).toBe('+250 ml')
    })
  })

  test('yesterday\'s water spans wake → yesterday bedTime, not now', () => {
    const raw = { ...baseRaw(), fuelYesterday: fuelWithWater(250) }
    const events = buildNeedsEvents(raw).hidratacio
    expect(events).toHaveLength(1)
    const wake = new Date(`${YESTERDAY}T${WAKE}:00`).getTime()
    const bed = new Date(`${YESTERDAY}T${BED}:00`).getTime()
    expect(events[0].at.getTime()).toBe(wake + (bed - wake) / 2)
  })

  test('0ml (< 1 glass) → no events', () => {
    const raw = { ...baseRaw(), fuelToday: fuelWithWater(200) }
    expect(buildNeedsEvents(raw).hidratacio).toEqual([])
  })
})

describe('buildNeedsEvents — 😴 pihenes (sleep)', () => {
  test('6h against an 8h (480min) goal → set 75 at today\'s wake time', () => {
    const raw = {
      ...baseRaw(),
      goalMinutes: 480,
      sleepLog: [{ date: TODAY, bedtime: '23:00', wakeup: '07:00', duration: 6, quality: 3, awakenings: 0, mealToSleep: 0, notes: null }],
    }
    const events = buildNeedsEvents(raw).pihenes
    expect(events).toEqual([
      { at: new Date(`${TODAY}T${WAKE}:00`), kind: 'set', amount: 75, label: '6,0 óra alvás' },
    ])
  })

  test('falls back to the latest of today/yesterday entries when today has none', () => {
    const raw = {
      ...baseRaw(),
      sleepLog: [
        { date: YESTERDAY, bedtime: '23:00', wakeup: '07:00', duration: 7.5, quality: 3, awakenings: 0, mealToSleep: 0, notes: null },
        { date: '2026-08-10', bedtime: '23:00', wakeup: '07:00', duration: 4, quality: 3, awakenings: 0, mealToSleep: 0, notes: null },
      ],
    }
    const events = buildNeedsEvents(raw).pihenes
    expect(events[0].label).toBe('7,5 óra alvás')
  })

  test('no sleep entry for today/yesterday → []', () => {
    const raw = { ...baseRaw(), sleepLog: [{ date: '2026-08-01', bedtime: '', wakeup: '', duration: 8, quality: 3, awakenings: 0, mealToSleep: 0, notes: null }] }
    expect(buildNeedsEvents(raw).pihenes).toEqual([])
  })
})

describe('buildNeedsEvents — 💪 mozgas (workouts + activity)', () => {
  test('a gym-done date within today/yesterday → set 100 at 12:00, label Edzés', () => {
    const raw = { ...baseRaw(), gymDoneDates: [TODAY] }
    expect(buildNeedsEvents(raw).mozgas).toEqual([
      { at: new Date(`${TODAY}T12:00:00`), kind: 'set', amount: 100, label: 'Edzés' },
    ])
  })

  test('a gym-done date outside today/yesterday is dropped', () => {
    const raw = { ...baseRaw(), gymDoneDates: ['2026-08-01'] }
    expect(buildNeedsEvents(raw).mozgas).toEqual([])
  })

  test('a run session date within range → set 100 at 12:00, label Futás', () => {
    const raw = { ...baseRaw(), runSessions: [{ date: YESTERDAY }] }
    expect(buildNeedsEvents(raw).mozgas).toEqual([
      { at: new Date(`${YESTERDAY}T12:00:00`), kind: 'set', amount: 100, label: 'Futás' },
    ])
  })

  test('a sport session uses its real isoDate + time (wall-clock), label Sport', () => {
    const raw = { ...baseRaw(), sportSessions: [{ isoDate: TODAY, time: '18:30' }] }
    expect(buildNeedsEvents(raw).mozgas).toEqual([
      { at: new Date(`${TODAY}T18:30:00`), kind: 'set', amount: 100, label: 'Sport' },
    ])
  })

  test('an activity with createdAt uses it; one without falls back to occurredOn+12:00, label Aktivitás', () => {
    const raw = {
      ...baseRaw(),
      activitiesToday: [
        { id: 'a1', occurredOn: TODAY, text: '', skillKey: null, confidence: null, xpAwarded: 25, categorizedBy: null, createdAt: `${TODAY}T09:30:00` },
      ],
      activitiesYesterday: [
        { id: 'a2', occurredOn: YESTERDAY, text: '', skillKey: null, confidence: null, xpAwarded: 25, categorizedBy: null },
      ],
    }
    const events = buildNeedsEvents(raw).mozgas
    expect(events).toEqual(expect.arrayContaining([
      { at: new Date(`${TODAY}T09:30:00`), kind: 'add', amount: 25, label: 'Aktivitás' },
      { at: new Date(`${YESTERDAY}T12:00:00`), kind: 'add', amount: 25, label: 'Aktivitás' },
    ]))
    expect(events).toHaveLength(2)
  })

  test('no gym/run/sport/activity sources → []', () => {
    expect(buildNeedsEvents(baseRaw()).mozgas).toEqual([])
  })
})

describe('buildNeedsEvents — 💗 lélek (check-ins + intention + ritual)', () => {
  test('a done check-in with savedAt', () => {
    const raw = { ...baseRaw(), checkinsToday: [{ time: '09:00', state: 'done' as const, values: null, note: null, savedAt: `${TODAY}T09:05:00` }] }
    expect(buildNeedsEvents(raw).lelek).toEqual([
      { at: new Date(`${TODAY}T09:05:00`), kind: 'add', amount: 20, label: 'Check-in' },
    ])
  })

  test('a done check-in without savedAt falls back to today + slot.time', () => {
    const raw = { ...baseRaw(), checkinsToday: [{ time: '09:00', state: 'done' as const, values: null, note: null }] }
    expect(buildNeedsEvents(raw).lelek).toEqual([
      { at: new Date(`${TODAY}T09:00:00`), kind: 'add', amount: 20, label: 'Check-in' },
    ])
  })

  test('a non-done check-in is ignored', () => {
    const raw = { ...baseRaw(), checkinsToday: [{ time: '09:00', state: 'pending' as const, values: null, note: null }] }
    expect(buildNeedsEvents(raw).lelek).toEqual([])
  })

  test('yesterday = intentionYesterday + ritualYesterday ONLY (checkins are today-only)', () => {
    const raw = {
      ...baseRaw(),
      checkinsToday: [], // today has nothing
      intentionToday: emptyIntention(TODAY), // today has nothing either
      intentionYesterday: { date: YESTERDAY, creed: null, foci: [{ id: 'f1', focusDate: YESTERDAY, text: 'x' }], reflection: 'yes' as const, focusCap: 3 },
      ritualYesterday: { date: YESTERDAY, closed: true, closedAt: `${YESTERDAY}T22:30:00`, reflectionText: null, window: { opensAt: '', prepStartsAt: '', bedTime: BED } },
    }
    const events = buildNeedsEvents(raw).lelek
    expect(events).toEqual(expect.arrayContaining([
      { at: addFifteen(`${YESTERDAY}T${WAKE}:00`), kind: 'add', amount: 15, label: 'Szándék' },
      { at: new Date(`${YESTERDAY}T21:00:00`), kind: 'add', amount: 25, label: 'Reflexió' },
      { at: new Date(`${YESTERDAY}T22:30:00`), kind: 'add', amount: 25, label: 'Napzárás' },
    ]))
    expect(events).toHaveLength(3)
  })

  test('today foci → +intention at wake+15min; today reflection set → +reflection at 21:00', () => {
    const raw = {
      ...baseRaw(),
      intentionToday: { date: TODAY, creed: null, foci: [{ id: 'f1', focusDate: TODAY, text: 'x' }], reflection: 'no' as const, focusCap: 3 },
    }
    const events = buildNeedsEvents(raw).lelek
    expect(events).toEqual(expect.arrayContaining([
      { at: addFifteen(`${TODAY}T${WAKE}:00`), kind: 'add', amount: 15, label: 'Szándék' },
      { at: new Date(`${TODAY}T21:00:00`), kind: 'add', amount: 25, label: 'Reflexió' },
    ]))
  })

  test('an open (unclosed) ritual yesterday contributes nothing', () => {
    const raw = { ...baseRaw(), ritualYesterday: { date: YESTERDAY, closed: false, closedAt: null, reflectionText: null, window: { opensAt: '', prepStartsAt: '', bedTime: BED } } }
    expect(buildNeedsEvents(raw).lelek).toEqual([])
  })

  test('no check-ins/intention/ritual sources → []', () => {
    expect(buildNeedsEvents(baseRaw()).lelek).toEqual([])
  })
})

function addFifteen(iso: string): Date {
  return new Date(new Date(iso).getTime() + 15 * 60_000)
}

describe('buildNeedsEvents — ⚡ rend (habit ticks)', () => {
  test('a done habit with doneAt', () => {
    const raw = { ...baseRaw(), habitsToday: [habit({ status: 'done', doneAt: `${TODAY}T08:15:00`, title: 'Ivás' })] }
    expect(buildNeedsEvents(raw).rend).toEqual([
      { at: new Date(`${TODAY}T08:15:00`), kind: 'add', amount: 12, label: 'Ivás' },
    ])
  })

  test('a done habit without doneAt falls back to that day\'s 12:00, uses the habit title', () => {
    const raw = { ...baseRaw(), habitsYesterday: [habit({ status: 'done', doneAt: null, title: 'Nyújtás' })] }
    expect(buildNeedsEvents(raw).rend).toEqual([
      { at: new Date(`${YESTERDAY}T12:00:00`), kind: 'add', amount: 12, label: 'Nyújtás' },
    ])
  })

  test('a pending habit is ignored', () => {
    const raw = { ...baseRaw(), habitsToday: [habit({ status: 'pending' })] }
    expect(buildNeedsEvents(raw).rend).toEqual([])
  })

  test('no habits on either day → []', () => {
    expect(buildNeedsEvents(baseRaw()).rend).toEqual([])
  })
})

const needState = (key: NeedState['key'], pct: number): NeedState => ({
  key, emoji: '', label: '', color: '', pct, ratePerHour: 0, zeroAt: null, band: 'green',
  lastFill: null, todayFills: [],
})

describe('ringsOf — NeedState[] → NeedsRings wire shape', () => {
  test('maps each ring\'s (already-rounded) pct into the wire object, keyed by NeedKey', () => {
    const states: NeedState[] = [
      needState('energia', 80), needState('hidratacio', 75), needState('pihenes', 90),
      needState('mozgas', 60), needState('lelek', 100), needState('rend', 65),
    ]
    expect(ringsOf(states)).toEqual({ energia: 80, hidratacio: 75, pihenes: 90, mozgas: 60, lelek: 100, rend: 65 })
  })

  test('rounds a fractional pct (defensive — NeedState.pct is already an integer)', () => {
    const states: NeedState[] = [
      needState('energia', 80.4), needState('hidratacio', 75.6), needState('pihenes', 90),
      needState('mozgas', 60), needState('lelek', 100), needState('rend', 65),
    ]
    expect(ringsOf(states)).toEqual({ energia: 80, hidratacio: 76, pihenes: 90, mozgas: 60, lelek: 100, rend: 65 })
  })

  test('a missing ring key defaults to 0', () => {
    const states: NeedState[] = [needState('energia', 80)]
    expect(ringsOf(states)).toEqual({ energia: 80, hidratacio: 0, pihenes: 0, mozgas: 0, lelek: 0, rend: 0 })
  })
})

describe('buildNeedsEvents — malformed/missing sources never throw', () => {
  test('a fully empty snapshot returns empty arrays for every ring', () => {
    expect(() => buildNeedsEvents(baseRaw())).not.toThrow()
    const events = buildNeedsEvents(baseRaw())
    expect(events).toEqual({ energia: [], hidratacio: [], pihenes: [], mozgas: [], lelek: [], rend: [] })
  })

  test('a zero/negative sleep goal never divides by zero', () => {
    const raw = {
      ...baseRaw(),
      goalMinutes: 0,
      sleepLog: [{ date: TODAY, bedtime: '', wakeup: '', duration: 6, quality: 3, awakenings: 0, mealToSleep: 0, notes: null }],
    }
    expect(() => buildNeedsEvents(raw)).not.toThrow()
    expect(buildNeedsEvents(raw).pihenes).toEqual([])
  })
})
