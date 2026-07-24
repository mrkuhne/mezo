import { describe, expect, it } from 'vitest'
import { muscleColor, muscleRegion, REGION_LABELS, REGION_ORDER } from '@/features/train/logic/muscleColors'

describe('muscleColor', () => {
  it('maps chest to the coral family', () => {
    expect(muscleColor('chest')).toEqual({
      rail: 'var(--coral)', wash: 'var(--wash-gym)', deep: 'var(--tag-gym)',
    })
  })
  it('maps every back muscle (incl. legacy "back") to the sky family', () => {
    for (const m of ['back-mid', 'lats', 'traps', 'back']) {
      expect(muscleColor(m).rail).toBe('var(--sky)')
    }
  })
  it('maps shoulders to lav, arms to rose, legs to sage, core to amber', () => {
    expect(muscleColor('shoulder').rail).toBe('var(--lav)')
    expect(muscleColor('rear-delt').rail).toBe('var(--lav)')
    expect(muscleColor('biceps').rail).toBe('var(--rose)')
    expect(muscleColor('triceps').rail).toBe('var(--rose)')
    for (const m of ['quad', 'ham', 'glute', 'calf']) {
      expect(muscleColor(m).rail).toBe('var(--sage)')
    }
    expect(muscleColor('core').rail).toBe('var(--amber)')
  })
  it('falls back to neutral tokens for unknown keys', () => {
    expect(muscleColor('unknown-muscle')).toEqual({
      rail: 'var(--text-tertiary)', wash: 'var(--surface-2)', deep: 'var(--text-secondary)',
    })
  })
})

describe('muscleRegion (mezo-ly27)', () => {
  it('maps every catalog muscle to its color-family region', () => {
    expect(muscleRegion('chest')).toBe('coral')
    expect(muscleRegion('lats')).toBe('sky')
    expect(muscleRegion('back')).toBe('sky') // legacy key
    expect(muscleRegion('rear-delt')).toBe('lav')
    expect(muscleRegion('triceps')).toBe('rose')
    expect(muscleRegion('calf')).toBe('sage')
    expect(muscleRegion('core')).toBe('amber')
  })
  it('returns null for unknown muscles', () => {
    expect(muscleRegion('sport')).toBeNull()
    expect(muscleRegion('')).toBeNull()
  })
  it('labels + order cover the six regions', () => {
    expect(REGION_ORDER).toEqual(['coral', 'sky', 'lav', 'rose', 'sage', 'amber'])
    expect(REGION_LABELS.coral).toBe('Mell')
    expect(REGION_LABELS.sky).toBe('Hát')
    expect(REGION_LABELS.lav).toBe('Váll')
    expect(REGION_LABELS.rose).toBe('Kar')
    expect(REGION_LABELS.sage).toBe('Láb')
    expect(REGION_LABELS.amber).toBe('Core')
  })
})
