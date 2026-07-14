import { expect, test } from 'vitest'
import { daySessions } from '@/features/train/logic/agenda'
import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'

const day = (over: Partial<WeeklyAgendaDay>): WeeklyAgendaDay =>
  ({ day: 'Kedd', gym: null, sport: [], running: [], isToday: false, ...over })

test('orders gym/volleyball/running by time, untimed last', () => {
  const items = daySessions(day({
    gym: { day: 'Kedd', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
    running: [{ key: 'tue-sprint', timeOfDay: '08:00', label: 'Sprint', kind: 'sprint' } as never],
    sport: [{ day: 'Kedd', time: null, duration: 90 } as never], // untimed
  }))
  expect(items.map((i) => i.kind)).toEqual(['running', 'gym', 'sport'])
  expect(items[0].timeOfDay).toBe('08:00')
})

test('same-time tie-break is stable by insertion order: gym before running', () => {
  const items = daySessions(day({
    gym: { day: 'Kedd', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
    running: [{ key: 'tue-easy', timeOfDay: '18:30', label: 'Easy', kind: 'easy' } as never],
  }))
  // daySessions pushes gym before running; the sort is stable, so equal times
  // preserve that insertion order.
  expect(items.map((i) => i.kind)).toEqual(['gym', 'running'])
})

test('a multi-sport day flattens every sport slot, ordered by time', () => {
  const items = daySessions(day({
    sport: [
      { day: 'Kedd', time: '19:00', duration: 90, sport: 'volleyball' } as never,
      { day: 'Kedd', time: '12:00', duration: 60, sport: 'trx' } as never,
    ],
  }))
  expect(items.map((i) => i.kind)).toEqual(['sport', 'sport'])
  expect(items.map((i) => i.timeOfDay)).toEqual(['12:00', '19:00'])
})
