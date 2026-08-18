import { describe, expect, it } from 'vitest'
import { forecastToday, type NotificationForecastAnchors } from '@/features/me/logic/notificationForecast'
import type { NotificationCategoryKey, NotificationPrefView } from '@/data/types'
import type { components } from '@/data/_client/api.gen'

type NotificationScheduleEntry = components['schemas']['NotificationScheduleEntry']

const NO_ANCHORS: NotificationForecastAnchors = {
  wake: '06:30',
  bedTime: null,
  gymTime: null,
  ritualOpensAt: null,
  ritualPrepStartsAt: null,
  medicationDay: false,
}

function pref(category: NotificationCategoryKey, enabled: boolean, leadMinutes = 0): NotificationPrefView {
  return { category, enabled, leadMinutes }
}

function scheduleEntry(overrides: Partial<NotificationScheduleEntry> & { category: string; time: string }): NotificationScheduleEntry {
  return {
    weekday: null, title: 'title', body: null, deeplink: '/today', source: 'test',
    ...overrides,
  }
}

const WEDNESDAY = 3 // ISO 1=Mon..7=Sun

describe('forecastToday (pure)', () => {
  it('an empty pref set yields total 0 and all-zero hour buckets', () => {
    const result = forecastToday([], [], NO_ANCHORS, WEDNESDAY)
    expect(result.total).toBe(0)
    expect(result.perHour).toHaveLength(24)
    expect(result.perHour.every((n) => n === 0)).toBe(true)
    expect(result.denseWindows).toEqual([])
  })

  it('counts only ENABLED categories — a disabled category with a resolvable anchor contributes nothing', () => {
    const prefs = [pref('briefing', false), pref('midday', false)]
    const result = forecastToday(prefs, [], { ...NO_ANCHORS, wake: '06:40' }, WEDNESDAY)
    expect(result.total).toBe(0)
  })

  it('an enabled category with no resolvable anchor today (e.g. no gym scheduled) is honestly skipped', () => {
    const prefs = [pref('gym', true, 30)]
    const result = forecastToday(prefs, [], { ...NO_ANCHORS, gymTime: null }, WEDNESDAY)
    expect(result.total).toBe(0)
  })

  it("the gym lead shifts its hour bucket (17:00 slot, 30-min lead -> fires 16:30, bucket 16 not 17)", () => {
    const prefs = [pref('gym', true, 30)]
    const result = forecastToday(prefs, [], { ...NO_ANCHORS, gymTime: '17:00' }, WEDNESDAY)
    expect(result.total).toBe(1)
    expect(result.perHour[16]).toBe(1)
    expect(result.perHour[17]).toBe(0)
  })

  it('a schedule entry with weekday: null fires every day', () => {
    const prefs = [pref('checkin', true)]
    const entries = [scheduleEntry({ category: 'checkin', time: '06:30', weekday: null })]
    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      expect(forecastToday(prefs, entries, NO_ANCHORS, weekday).total).toBe(1)
    }
  })

  it('a schedule entry pinned to one weekday fires only that day', () => {
    const prefs = [pref('fuel_slot', true)]
    const entries = [scheduleEntry({ category: 'fuel_slot', time: '07:00', weekday: 2 })] // Tuesday only
    expect(forecastToday(prefs, entries, NO_ANCHORS, 2).total).toBe(1)
    expect(forecastToday(prefs, entries, NO_ANCHORS, WEDNESDAY).total).toBe(0)
  })

  it('two items within 15 minutes of each other produce a dense window', () => {
    const prefs = [pref('ritual', true), pref('lights_out', true)]
    const anchors: NotificationForecastAnchors = { ...NO_ANCHORS, ritualOpensAt: '21:00', bedTime: '21:10' }
    const result = forecastToday(prefs, [], anchors, WEDNESDAY)
    expect(result.total).toBe(2)
    expect(result.denseWindows).toEqual([{ fromHHmm: '21:00', toHHmm: '21:10', count: 2 }])
  })

  it('two items more than 15 minutes apart do NOT form a dense window', () => {
    const prefs = [pref('ritual', true), pref('lights_out', true)]
    const anchors: NotificationForecastAnchors = { ...NO_ANCHORS, ritualOpensAt: '21:00', bedTime: '21:30' }
    const result = forecastToday(prefs, [], anchors, WEDNESDAY)
    expect(result.total).toBe(2)
    expect(result.denseWindows).toEqual([])
  })

  it('weekly fires only on Monday, memoir only on Sunday, even when both are enabled every day', () => {
    const prefs = [pref('weekly', true), pref('memoir', true)]
    const monday = forecastToday(prefs, [], { ...NO_ANCHORS, wake: '06:30' }, 1)
    expect(monday.total).toBe(1) // weekly only
    const sunday = forecastToday(prefs, [], { ...NO_ANCHORS, wake: '06:30' }, 7)
    expect(sunday.total).toBe(1) // memoir only
    const wednesday = forecastToday(prefs, [], { ...NO_ANCHORS, wake: '06:30' }, WEDNESDAY)
    expect(wednesday.total).toBe(0)
  })

  it('medication counts only on an active dose day, never on the honest cycleDay===0 "no dose" state', () => {
    const prefs = [pref('medication', true)]
    expect(forecastToday(prefs, [], { ...NO_ANCHORS, medicationDay: false }, WEDNESDAY).total).toBe(0)
    expect(forecastToday(prefs, [], { ...NO_ANCHORS, medicationDay: true }, WEDNESDAY).total).toBe(1)
  })

  it('evening counts every day at its fixed 20:30 anchor', () => {
    const prefs = [pref('evening', true)]
    const result = forecastToday(prefs, [], NO_ANCHORS, WEDNESDAY)
    expect(result.total).toBe(1)
    expect(result.perHour[20]).toBe(1)
  })

  it('sleep_reaction and weight_reaction are honestly skipped — no client-resolvable anchor', () => {
    const prefs = [pref('sleep_reaction', true), pref('weight_reaction', true)]
    const result = forecastToday(prefs, [], NO_ANCHORS, WEDNESDAY)
    expect(result.total).toBe(0)
  })
})
