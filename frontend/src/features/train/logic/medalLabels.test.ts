import { describe, expect, test } from 'vitest'
import { medalValueLabel } from '@/features/train/logic/medalLabels'
import type { Medal } from '@/data/train/medalTypes'

// Base RECORD-tier medal; each case overrides only what it exercises.
const base: Medal = {
  type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Chest Supported Row',
  date: '2026-06-02', setIndex: 2,
  value: 102.5, unit: 'KG', weightKg: 102.5, reps: 8,
  previousValue: 100, previousDate: '2026-05-19',
}

describe('medalValueLabel', () => {
  // E1RM deliberately does NOT belong here — its headline is the estimate, not
  // the set. It used to be in this list, which is exactly why the bug shipped:
  // the test asserted the defect. Its correct behavior is pinned further down.
  test.each([
    ['WEIGHT', '102,5 kg × 8'],
    ['REPS_AT_WEIGHT', '102,5 kg × 8'],
    ['TARGET_HIT', '102,5 kg × 8'],
  ] as const)('%s with weightKg/reps renders the achieving set', (type, expected) => {
    expect(medalValueLabel({ ...base, type })).toBe(expected)
  })

  // The regression case (mezo-wp6n Finding 1): the real backend always populates
  // weightKg/reps on a SESSION_VOLUME medal too (MedalService.toMedal — the top set
  // names the lift the row shows), but the headline must stay the session volume
  // (`value`, kg), never `weightKg × reps` — that's one set's load, not comparable
  // to the "previous" (itself a volume), and reads as an indistinguishable WEIGHT row.
  test('SESSION_VOLUME with weightKg/reps still headlines the raw value, not the set', () => {
    const medal: Medal = {
      ...base, type: 'SESSION_VOLUME', value: 820, unit: 'KG',
      weightKg: 102.5, reps: 8, previousValue: 800, previousDate: '2026-05-22',
    }
    expect(medalValueLabel(medal)).toBe('820 kg')
    expect(medalValueLabel(medal)).not.toBe('102,5 kg × 8')
  })

  test('SESSION_VOLUME without weightKg/reps also headlines the raw value (mock-mode shape)', () => {
    const medal: Medal = {
      ...base, type: 'SESSION_VOLUME', value: 950, unit: 'KG',
      weightKg: null, reps: null, previousValue: 900, previousDate: '2026-06-29',
    }
    expect(medalValueLabel(medal)).toBe('950 kg')
  })

  test('a medal with no weightKg/reps at all falls through to raw value + unit', () => {
    const medal: Medal = { ...base, type: 'TARGET_HIT', weightKg: null, reps: null, value: 10, unit: 'REPS' }
    expect(medalValueLabel(medal)).toBe('10 rep')
  })

  // mezo-je3u: E1RM's headline is the ESTIMATE and previousValue is the prior
  // estimate, so printing the achieving set put "22 kg × 12" next to
  // "Előző: 28 kg" — a record rendered as a regression.
  test('E1RM headlines the estimate, not the set that achieved it', () => {
    const medal: Medal = {
      ...base, type: 'E1RM', value: 30.7, unit: 'KG',
      weightKg: 22, reps: 12, previousValue: 28, previousDate: '2026-06-15',
    }
    expect(medalValueLabel(medal)).toBe('30,7 kg')
    expect(medalValueLabel(medal)).not.toBe('22 kg × 12')
  })
})
