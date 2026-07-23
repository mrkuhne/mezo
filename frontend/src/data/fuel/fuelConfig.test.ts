import { describe, it, expect } from 'vitest'
import { toHHmm, toMin } from '@/data/fuel/fuelConfig'

describe('time helpers (sanity)', () => {
  it('round-trips minutes ↔ HH:mm', () => {
    expect(toHHmm(toMin('21:30'))).toBe('21:30')
  })
})
