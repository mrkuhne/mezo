import { describe, expect, it } from 'vitest'
import {
  EMPHASIZE_CAP,
  TIER_GROUPS,
  TIER_LABELS,
  setTier,
  tierOf,
  tierTargetOf,
} from '@/features/train/logic/musclePriorities'

describe('musclePriorities', () => {
  it('TIER_GROUPS lists the 9 landmark groups, no traps/core', () => {
    expect(TIER_GROUPS).toEqual(['chest', 'back', 'shoulder', 'biceps', 'triceps', 'quad', 'ham', 'glute', 'calf'])
  })

  it('TIER_LABELS maps each tier to its English label', () => {
    expect(TIER_LABELS).toEqual({ emphasize: 'Emphasize', grow: 'Grow', maintain: 'Maintain' })
  })

  it('EMPHASIZE_CAP is 2', () => {
    expect(EMPHASIZE_CAP).toBe(2)
  })

  describe('tierOf', () => {
    it('defaults to grow when the group is absent from the map', () => {
      expect(tierOf({}, 'chest')).toBe('grow')
    })
    it('defaults to grow when priorities is null or undefined', () => {
      expect(tierOf(null, 'chest')).toBe('grow')
      expect(tierOf(undefined, 'chest')).toBe('grow')
    })
    it('returns the stored tier for a known group', () => {
      expect(tierOf({ back: 'emphasize' }, 'back')).toBe('emphasize')
      expect(tierOf({ back: 'maintain' }, 'back')).toBe('maintain')
    })
  })

  describe('setTier', () => {
    it('sets emphasize as an explicit key', () => {
      expect(setTier({}, 'chest', 'emphasize')).toEqual({ chest: 'emphasize' })
    })
    it('sets maintain as an explicit key', () => {
      expect(setTier({}, 'chest', 'maintain')).toEqual({ chest: 'maintain' })
    })
    it('setting grow deletes the key — returns a sparse map', () => {
      expect(setTier({ back: 'emphasize' }, 'back', 'grow')).toEqual({})
    })
    it('does not mutate the input map', () => {
      const input = { back: 'emphasize' as const }
      setTier(input, 'back', 'grow')
      expect(input).toEqual({ back: 'emphasize' })
    })
    it('leaves other keys untouched', () => {
      expect(setTier({ back: 'emphasize', chest: 'maintain' }, 'back', 'grow')).toEqual({ chest: 'maintain' })
    })
  })

  describe('tierTargetOf', () => {
    const lm = { mev: 4, mav: 12, mrv: 20 }
    it('emphasize targets mrv', () => {
      expect(tierTargetOf('emphasize', lm)).toBe(20)
    })
    it('grow targets mav', () => {
      expect(tierTargetOf('grow', lm)).toBe(12)
    })
    it('maintain targets mev', () => {
      expect(tierTargetOf('maintain', lm)).toBe(4)
    })
  })
})
