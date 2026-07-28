import { expect, test } from 'vitest'
import { buildWeekAgenda } from '@/features/train/logic/weekAgenda'
import { DAY_ORDER } from '@/data/train/train'

const gym = (day: string, time: string) => ({ day, active: true, time, duration: 75, type: `${day} nap` }) as never
const sport = (day: string, time: string) => ({ day, time, duration: 90, court: 'BVSC', intensity: 'közepes', role: 'edzés' }) as never

test('returns one entry per weekday in DAY_ORDER order, with ISO dates', () => {
  const agenda = buildWeekAgenda({ gymTimes: [], sportSlots: [], runningBlock: null, weekWorkouts: [] })
  expect(agenda).toHaveLength(7)
  expect(agenda.map((a) => a.day)).toEqual([...DAY_ORDER])
  for (const a of agenda) expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('places gym slots and sport slots on their own day, dropping inactive gym slots', () => {
  const agenda = buildWeekAgenda({
    gymTimes: [gym('Kedd', '07:30'), { ...(gym('Sze', '07:30') as object), active: false } as never],
    sportSlots: [sport('Kedd', '18:00'), sport('Kedd', '20:00')],
    runningBlock: null,
    weekWorkouts: [],
  })
  const tue = agenda.find((a) => a.day === 'Kedd')!
  expect(tue.gym?.time).toBe('07:30')
  expect(tue.sport).toHaveLength(2)
  expect(agenda.find((a) => a.day === 'Sze')!.gym).toBeNull()
})

test('attaches completed custom instances by ISO date and flags today from the slot flags', () => {
  const agenda = buildWeekAgenda({
    gymTimes: [{ ...(gym('Csü', '07:30') as object), today: true } as never],
    sportSlots: [],
    runningBlock: null,
    weekWorkouts: [],
  })
  expect(agenda.find((a) => a.day === 'Csü')!.isToday).toBe(true)
  expect(agenda.filter((a) => a.isToday)).toHaveLength(1)
})

// The `custom` population itself was never covered — the case the name above promises
// (mezo-9bbc final review, I6). Clock pinned so the week is Mon 2026-07-13 … Sun 07-19.
test('populates `custom` only from COMPLETED custom instances, on their own date', () => {
  const today = new Date(2026, 6, 15) // Wednesday 2026-07-15
  const agenda = buildWeekAgenda({
    gymTimes: [], sportSlots: [], runningBlock: null, today,
    weekWorkouts: [
      { id: 'w1', date: '2026-07-18', origin: 'custom', status: 'completed', title: 'Pihenőnapi felső' },
      { id: 'w2', date: '2026-07-18', origin: 'custom', status: 'completed', title: 'Esti core' },
      { id: 'w3', date: '2026-07-17', origin: 'custom', status: 'active', title: 'Félbehagyott' },
      { id: 'w4', date: '2026-07-16', origin: 'meso', status: 'completed', title: 'Pull Day' },
    ],
  })
  // both Saturday instances attach, in list order, carrying only id + title
  expect(agenda.find((a) => a.day === 'Szo')!.custom).toEqual([
    { id: 'w1', title: 'Pihenőnapi felső' },
    { id: 'w2', title: 'Esti core' },
  ])
  // an unfinished custom instance and a completed MESO instance are not custom rows
  expect(agenda.find((a) => a.day === 'Pén')!.custom).toEqual([])
  expect(agenda.find((a) => a.day === 'Csü')!.custom).toEqual([])
  expect(agenda.filter((a) => a.custom!.length > 0)).toHaveLength(1)
})
