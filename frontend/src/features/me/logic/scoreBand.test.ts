import { describe, expect, test } from 'vitest'
import { scoreBand, scoreBandClass, scoreBandColor, scoreDelta } from './scoreBand'

describe('scoreBand', () => {
  test('the three bands split at 80 and 70, inclusive on the lower edge', () => {
    expect(scoreBand(100)).toBe('hi')
    expect(scoreBand(80)).toBe('hi')
    expect(scoreBand(79)).toBe('mid')
    expect(scoreBand(70)).toBe('mid')
    expect(scoreBand(69)).toBe('low')
    expect(scoreBand(0)).toBe('low')
  })

  test('a missing score is its own band, never the lowest one', () => {
    expect(scoreBand(null)).toBe('non')
    expect(scoreBand(undefined)).toBe('non')
    expect(scoreBandClass(null)).toBe('sc-non')
    expect(scoreBandColor(null)).toBe('var(--mz-sc-non-ink)')
  })

  test('band colours resolve to tokens, never to literals', () => {
    expect(scoreBandColor(82)).toBe('var(--mz-sc-hi-ring)')
    expect(scoreBandColor(72)).toBe('var(--mz-sc-mid-ring)')
    expect(scoreBandColor(50)).toBe('var(--mz-sc-low-ring)')
  })
})

describe('scoreDelta', () => {
  test('signs the difference and uses the HU minus sign', () => {
    expect(scoreDelta(78, 74)).toEqual({ text: '+4', direction: 'up' })
    expect(scoreDelta(71, 74)).toEqual({ text: '−3', direction: 'down' })
  })

  test('an exact tie is ±0, not a green zero (audit §8.3)', () => {
    expect(scoreDelta(74, 74)).toEqual({ text: '±0', direction: 'flat' })
  })

  test('an unknown side yields no pill at all — never a fabricated zero', () => {
    expect(scoreDelta(null, 74)).toBeNull()
    expect(scoreDelta(78, null)).toBeNull()
  })
})
