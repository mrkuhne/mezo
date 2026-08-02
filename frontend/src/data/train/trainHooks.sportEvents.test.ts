// mergeEventsIntoSchedule (mezo-e1sp): one-off events join the current week's rhythm as
// dated sessions; other weeks' events stay out, and an event-less base passes through
// UNCHANGED (reference equality — the mock byte-parity guarantee).
import { expect, test } from 'vitest'
import { mergeEventsIntoSchedule } from '@/data/train/trainHooks'
import { addDays, localDateString } from '@/shared/lib/dates'
import type { SportEventResponse } from '@/data/train/trainApi'
import type { SportSchedule } from '@/data/types'

const base: SportSchedule = {
  volleyball: {
    team: 'BVSC', season: 'Ősz', weeklyHours: 4.5,
    sessions: [{ day: 'Kedd', time: '18:00', duration: 90, court: 'BVSC', intensity: '', role: 'edzés' }],
  },
}

const ev = (date: string, p: Partial<SportEventResponse> = {}): SportEventResponse => ({
  id: `e-${date}-${p.time ?? '19:00'}`,
  date, time: '19:00', durationMin: 120, kind: 'match', sport: 'volleyball', location: 'Kőbánya Sport',
  ...p,
})

// A this-week date that is NOT today (today ±1 within the same Mon–Sun week).
const thisWeekNotToday = () => {
  const today = localDateString()
  const idx = (new Date().getDay() + 6) % 7 // 0=Mon..6=Sun
  return idx < 6 ? addDays(today, 1) : addDays(today, -1)
}

test('no events → the base schedule passes through untouched (same reference)', () => {
  expect(mergeEventsIntoSchedule(base, [])).toBe(base)
  expect(mergeEventsIntoSchedule(null, [])).toBeNull()
})

test('an out-of-week event does not merge (the base stays untouched)', () => {
  expect(mergeEventsIntoSchedule(base, [ev(addDays(localDateString(), 14))])).toBe(base)
})

test("today's event merges as a dated one-off with the today flag", () => {
  const today = localDateString()
  const merged = mergeEventsIntoSchedule(base, [ev(today), ev(addDays(today, 21))])!
  expect(merged.volleyball.sessions).toHaveLength(2)
  const oneOff = merged.volleyball.sessions[1]
  expect(oneOff).toMatchObject({
    date: today, oneOff: true, today: true,
    time: '19:00', duration: 120, role: 'meccs', sport: 'volleyball', court: 'Kőbánya Sport',
  })
  // the recurring rhythm's hero stat stays untouched by one-offs
  expect(merged.volleyball.weeklyHours).toBe(4.5)
})

test('a this-week (but not today) event merges WITHOUT the today flag', () => {
  const merged = mergeEventsIntoSchedule(base, [ev(thisWeekNotToday(), { kind: 'training', sport: 'trx' })])!
  const oneOff = merged.volleyball.sessions[1]
  expect(oneOff.today).toBeUndefined()
  expect(oneOff).toMatchObject({ oneOff: true, role: 'edzés', sport: 'trx' })
})

test('an events-only week yields a schedule even with no recurring base', () => {
  const merged = mergeEventsIntoSchedule(null, [ev(localDateString())])!
  expect(merged.volleyball.sessions).toHaveLength(1)
  expect(merged.volleyball.weeklyHours).toBe(0)
  expect(merged.volleyball.team).toBe('')
})
