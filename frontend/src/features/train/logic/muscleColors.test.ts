import { describe, expect, it } from 'vitest'
import { muscleColor } from '@/features/train/logic/muscleColors'

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
