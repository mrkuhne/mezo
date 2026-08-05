import { expect, test } from 'vitest'
import { HABIT_METRIC_PALETTE } from '@/features/me/logic/habitMetricPalette'

test('every metric key is unique', () => {
  const keys = HABIT_METRIC_PALETTE.map((m) => m.metric)
  expect(new Set(keys).size).toBe(keys.length)
})

test('every label is non-empty', () => {
  for (const m of HABIT_METRIC_PALETTE) {
    expect(m.label.trim().length).toBeGreaterThan(0)
  }
})

test('the palette never lists "manual" (that is the MANUAL mode default, not a DERIVED metric)', () => {
  expect(HABIT_METRIC_PALETTE.some((m) => m.metric === 'manual')).toBe(false)
})

test('is non-empty (the editor always has something to offer a DERIVED habit)', () => {
  expect(HABIT_METRIC_PALETTE.length).toBeGreaterThan(0)
})
