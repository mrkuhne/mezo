import { describe, expect, it } from 'vitest'
import { radarMax, polarPoint, dataPolygonPoints } from '@/features/me/components/radarGeometry'

describe('radarGeometry', () => {
  it('radarMax floors at 10 and expands past it', () => {
    expect(radarMax([3, 4.5, 6.8])).toBe(10)
    expect(radarMax([3, 12.2])).toBe(13)
  })

  it('axis 0 is straight up (top vertex)', () => {
    const p = polarPoint(124, 124, 88, 0, 6)
    expect(p.x).toBeCloseTo(124, 1)
    expect(p.y).toBeCloseTo(36, 1) // 124 - 88
  })

  it('axis 3 of 6 is straight down (bottom vertex)', () => {
    const p = polarPoint(124, 124, 88, 3, 6)
    expect(p.x).toBeCloseTo(124, 1)
    expect(p.y).toBeCloseTo(212, 1) // 124 + 88
  })

  it('dataPolygonPoints scales each value by radius*v/max', () => {
    // single axis up, value 5 of max 10 → half radius up
    const pts = dataPolygonPoints(124, 124, 88, [5], 10)
    const [x, y] = pts.split(' ')[0].split(',').map(Number)
    expect(x).toBeCloseTo(124, 1)
    expect(y).toBeCloseTo(80, 1) // 124 - 44
  })
})
