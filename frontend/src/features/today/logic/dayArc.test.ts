import { buildArcPoints, arcProgress, pointXY } from '@/features/today/logic/dayArc'
import type { CheckinSlot } from '@/data/types'

const slot = (time: string, state: CheckinSlot['state']): CheckinSlot =>
  ({ time, state, values: null, note: '' }) as unknown as CheckinSlot

test('buildArcPoints maps check-ins, workout and sleep close onto the day span', () => {
  const pts = buildArcPoints({
    checkins: [slot('06:30', 'done'), slot('10:00', 'done'), slot('14:00', 'now'), slot('20:00', 'pending')],
    workoutTime: '17:00',
  })
  expect(pts).toHaveLength(6) // 4 checkins + workout + sleep(23:00)
  expect(pts[0]).toMatchObject({ kind: 'checkin-done', label: '06:30' })
  expect(pts[2]).toMatchObject({ kind: 'checkin-now', label: '14:00' })
  expect(pts[3]).toMatchObject({ kind: 'workout', label: '17:00' })
  expect(pts[5]).toMatchObject({ kind: 'sleep', label: '23:00' })
  const ts = pts.map(p => p.t)
  expect([...ts].sort((a, b) => a - b)).toEqual(ts) // monotonic along the day
  expect(ts[0]).toBeGreaterThanOrEqual(0)
  expect(ts[5]).toBeLessThanOrEqual(1)
})

test('buildArcPoints omits the workout point when there is no workout today', () => {
  const pts = buildArcPoints({ checkins: [slot('06:30', 'done')], workoutTime: null })
  expect(pts.map(p => p.kind)).toEqual(['checkin-done', 'sleep'])
})

test('arcProgress maps the 04:00–24:00 day window to 0..1', () => {
  expect(arcProgress(new Date('2026-07-13T04:00:00'))).toBeCloseTo(0, 2)
  expect(arcProgress(new Date('2026-07-13T14:00:00'))).toBeCloseTo(0.5, 2)
  expect(arcProgress(new Date('2026-07-13T23:59:00'))).toBeCloseTo(1, 1)
  expect(arcProgress(new Date('2026-07-13T02:00:00'))).toBe(1) // after midnight = day over
})

test('pointXY follows the arc geometry (endpoints and apex)', () => {
  expect(pointXY(0)).toEqual({ x: 22, y: 100 })
  expect(pointXY(1)).toEqual({ x: 342, y: 100 })
  expect(pointXY(0.5).y).toBeLessThan(50) // apex region is high
})
