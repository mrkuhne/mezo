import { describe, expect, test } from 'vitest'
import { buildTodayItems, itemsForFace, openCountByFace } from '@/features/today/logic/todayItems'
import type { DailyQuest, HabitItem } from '@/data/types'

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
