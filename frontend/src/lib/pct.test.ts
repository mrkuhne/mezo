import { describe, expect, it } from 'vitest'
import { pct } from './pct'

describe('pct', () => {
  it('returns the percentage a/b clamped to 100', () => {
    expect(pct(50, 100)).toBe(50)
    expect(pct(150, 100)).toBe(100) // clamped
    expect(pct(0, 100)).toBe(0)
  })

  it('returns 0 (never NaN/Infinity) when the denominator is 0', () => {
    // the dual-mode zero realEmpty (e.g. useFuelDay zero targets during real-mode load)
    // must render a benign 0%, not NaN% or Infinity%.
    expect(pct(0, 0)).toBe(0)
    expect(pct(5, 0)).toBe(0)
    expect(Number.isNaN(pct(0, 0))).toBe(false)
  })
})
