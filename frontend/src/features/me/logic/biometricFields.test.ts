import { describe, expect, test } from 'vitest'
import { ACTIVITY_LEVELS, ACTIVITY_SHORT, neatLabel, type ActivityLevel } from '@/features/me/logic/biometricFields'

describe('biometricFields NEAT bands', () => {
  test('exposes exactly the 3 NEAT bands with the right multipliers', () => {
    expect(ACTIVITY_LEVELS.map(a => a.id)).toEqual(['DESK', 'MIXED', 'PHYSICAL'])
    expect(ACTIVITY_LEVELS.map(a => a.neat)).toEqual([1.2, 1.35, 1.5])
  })
  test('hints describe non-exercise lifestyle (no "edzés")', () => {
    for (const a of ACTIVITY_LEVELS) expect(a.hint).not.toContain('edzés')
  })
  test('ACTIVITY_SHORT covers every band', () => {
    for (const id of ['DESK', 'MIXED', 'PHYSICAL'] as ActivityLevel[]) expect(ACTIVITY_SHORT[id]).toBeTruthy()
  })
  test('neatLabel formats with a decimal comma', () => {
    expect(neatLabel(1.35)).toBe('×1,35')
  })
})
