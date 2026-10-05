import { catmullRomPath, gridValues, lifelineGeometry, PLOT } from './lifelineGeometry'
import type { Lifeline } from '@/features/me/logic/lifeline'

const line = (over: Partial<Lifeline> = {}): Lifeline => ({
  points: [
    { weekStart: '2026-09-07', avgKg: 80.4 }, { weekStart: '2026-09-14', avgKg: 80.2 },
    { weekStart: '2026-09-21', avgKg: 79.8 }, { weekStart: '2026-09-28', avgKg: 79.6 },
  ],
  deltaKg: -0.8, sleepHours: [7, null, 6.5, 7.2], stations: [], targetKg: 73, remainingKg: 6.6, project: true,
  ...over,
})

test('points map monotonically: later weeks further right, lighter weeks lower on the plot', () => {
  const g = lifelineGeometry(line())
  for (let i = 1; i < g.pts.length; i++) {
    expect(g.pts[i].x).toBeGreaterThan(g.pts[i - 1].x)
    expect(g.pts[i].y).toBeGreaterThan(g.pts[i - 1].y) // the weight falls → y grows
  }
  expect(g.pts[0].x).toBe(PLOT.x0)
})

test('every point and the target stay inside the viewBox', () => {
  const g = lifelineGeometry(line())
  for (const p of g.pts) {
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeLessThanOrEqual(PLOT.h)
    expect(p.x).toBeLessThanOrEqual(PLOT.vbW)
  }
  expect(g.targetY).not.toBeNull()
  expect(g.targetY!).toBeGreaterThan(g.pts[g.pts.length - 1].y) // target is below the latest average
  expect(g.targetY!).toBeLessThanOrEqual(PLOT.h)
})

test('without a projection the target is not part of the scale and is not drawn', () => {
  const g = lifelineGeometry(line({ project: false }))
  expect(g.targetY).toBeNull()
  expect(g.projection).toBeNull()
  // the curve then uses the room the projection would have taken
  expect(g.pts[g.pts.length - 1].x).toBeGreaterThan(lifelineGeometry(line()).pts[3].x)
})

test('the path is one smoothed stroke: starts with M, one cubic segment per gap', () => {
  const g = lifelineGeometry(line())
  expect(g.path.startsWith('M')).toBe(true)
  expect(g.path.match(/C/g)).toHaveLength(3)
  expect(g.area.endsWith('Z')).toBe(true)
  expect(g.projection!.startsWith('M')).toBe(true)
  expect(catmullRomPath([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe('M0.0 0.0 C1.7 1.7 8.3 8.3 10.0 10.0')
})

test('a flat series does not divide by zero', () => {
  const g = lifelineGeometry(line({ project: false, points: [
    { weekStart: '2026-09-21', avgKg: 80 }, { weekStart: '2026-09-28', avgKg: 80 },
  ] }))
  for (const p of g.pts) expect(Number.isFinite(p.y)).toBe(true)
})

test('grid lines sit on round kg values inside the range, at most three', () => {
  expect(gridValues(72.2, 82.8)).toEqual([81, 78, 75])
  const tight = gridValues(79.2, 80.8)
  expect(tight.length).toBeGreaterThan(0)
  expect(tight.length).toBeLessThanOrEqual(3)
  for (const v of tight) { expect(v).toBeGreaterThanOrEqual(79.2); expect(v).toBeLessThanOrEqual(80.8) }
})
