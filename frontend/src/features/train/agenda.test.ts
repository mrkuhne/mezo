import { expect, test } from 'vitest'
import { daySessions } from './agenda'
import type { WeeklyAgendaDay } from './components/WeeklyDayRow'

const day = (over: Partial<WeeklyAgendaDay>): WeeklyAgendaDay =>
  ({ day: 'Kedd', gym: null, volleyball: null, running: [], isToday: false, ...over })

test('orders gym/volleyball/running by time, untimed last', () => {
  const items = daySessions(day({
    gym: { day: 'Kedd', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
    running: [{ key: 'tue-sprint', timeOfDay: '08:00', label: 'Sprint', kind: 'sprint' } as never],
    volleyball: { day: 'Kedd', time: null, duration: 90 } as never, // untimed
  }))
  expect(items.map((i) => i.kind)).toEqual(['running', 'gym', 'volleyball'])
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
