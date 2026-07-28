import { expect, test } from 'vitest'
import { dayStripItems } from '@/features/train/logic/dayStripItems'
import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'

const day = (over: Partial<WeeklyAgendaDay>): WeeklyAgendaDay => ({
  day: 'Kedd', date: '2026-05-19', gym: null, sport: [], running: [], isToday: false, ...over,
})

const gymSlot = { day: 'Kedd', active: true, time: '07:30', duration: 75, type: 'Legs' } as never
const trxSlot = { day: 'Kedd', time: '12:00', duration: 60, court: '', intensity: '', role: 'edzés', sport: 'trx' } as never
const run = { key: 'tue-sprint', timeOfDay: '18:00', label: 'Sprint', kind: 'sprint', rpeTarget: { min: 9, max: 10 } } as never

test('dots follow each session tone in time order', () => {
  const items = dayStripItems([day({ gym: gymSlot, sport: [trxSlot], running: [run] })], () => false)
  expect(items[0].dots).toEqual(['gym', 'trx', 'run'])
  expect(items[0].sessionCount).toBe(3)
  expect(items[0].doneCount).toBe(0)
})

test('doneCount counts the sessions the predicate marks done', () => {
  const items = dayStripItems([day({ gym: gymSlot, running: [run] })], (_d, item) => item.kind === 'gym')
  expect(items[0].doneCount).toBe(1)
  expect(items[0].sessionCount).toBe(2)
})

test('an empty day yields no dots and keeps its day number', () => {
  const items = dayStripItems([day({ day: 'Vas', date: '2026-05-24' })], () => false)
  expect(items[0]).toMatchObject({ day: 'Vas', dayNumber: 24, dots: [], sessionCount: 0 })
})

test('a day with no date falls back to dayNumber 0', () => {
  const items = dayStripItems([day({ date: undefined })], () => false)
  expect(items[0].dayNumber).toBe(0)
})
