import { describe, expect, test } from 'vitest'
import { dayFace, faceOf, faceWindows, DAY_FACES } from '@/features/today/logic/dayFace'

const GOAL = { wakeTime: '06:30', bedTime: '22:30' }
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2026, 4, 21)
  d.setHours(h, m, 0, 0)
  return d
}

describe('faceWindows', () => {
  test('tiles the circle from the sleep anchor: 06:00 / 11:30 / 18:30', () => {
    const w = faceWindows(GOAL)
    expect(w.reggel).toEqual({ start: 360, end: 690 })   // 06:00 – 11:30
    expect(w.nap).toEqual({ start: 690, end: 1110 })     // 11:30 – 18:30
    expect(w.este).toEqual({ start: 1110, end: 360 })    // 18:30 – 06:00 (wraps)
  })

  test('a past-midnight bed still produces three ordered windows', () => {
    const w = faceWindows({ wakeTime: '08:00', bedTime: '00:30' })
    expect(w.reggel).toEqual({ start: 450, end: 780 })   // 07:30 – 13:00
    expect(w.nap).toEqual({ start: 780, end: 1230 })     // 13:00 – 20:30
    expect(w.este).toEqual({ start: 1230, end: 450 })    // 20:30 – 07:30 (wraps)
  })
})

describe('dayFace', () => {
  test.each([
    ['05:59', 'este'], ['06:00', 'reggel'], ['09:12', 'reggel'], ['11:29', 'reggel'],
    ['11:30', 'nap'], ['13:42', 'nap'], ['18:29', 'nap'],
    ['18:30', 'este'], ['21:05', 'este'], ['23:59', 'este'], ['02:00', 'este'],
  ] as const)('%s → %s', (t, expected) => {
    expect(dayFace(at(t), GOAL)).toBe(expected)
  })

  test('never returns undefined for any minute of the day', () => {
    for (let m = 0; m < 1440; m++) {
      const d = new Date(2026, 4, 21)
      d.setHours(Math.floor(m / 60), m % 60, 0, 0)
      expect(DAY_FACES).toContain(dayFace(d, GOAL))
    }
  })

  test('a degenerate anchor (2h awake) still resolves every minute to a face', () => {
    const tiny = { wakeTime: '06:00', bedTime: '08:00' }
    for (let m = 0; m < 1440; m += 7) {
      const d = new Date(2026, 4, 21)
      d.setHours(Math.floor(m / 60), m % 60, 0, 0)
      expect(DAY_FACES).toContain(dayFace(d, tiny))
    }
  })
})

describe('faceOf', () => {
  test.each([
    ['06:30', 'reggel'], ['14:00', 'nap'], ['17:00', 'nap'], ['20:00', 'este'], ['21:15', 'este'],
  ] as const)('a %s item belongs to %s', (t, expected) => {
    expect(faceOf(t, GOAL)).toBe(expected)
  })
})
