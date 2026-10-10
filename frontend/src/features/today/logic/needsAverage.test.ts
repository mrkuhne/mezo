import { expect, test } from 'vitest'
import { needsAttentionLine, needsAverage } from '@/features/today/logic/needsAverage'

test('the average is the rounded mean, and null when there is nothing to average', () => {
  expect(needsAverage([])).toBeNull()
  expect(needsAverage([{ pct: 72 }, { pct: 52 }, { pct: 81 }, { pct: 34 }, { pct: 64 }, { pct: 58 }])).toBe(60)
  expect(needsAverage([{ pct: 1 }, { pct: 2 }])).toBe(2)
})

test('the attention line names the need only when exactly one is low', () => {
  expect(needsAttentionLine([{ key: 'mozgas', band: 'red' }, { key: 'rend', band: 'green' }])).toBe('a mozgás kér figyelmet')
  expect(needsAttentionLine([{ key: 'pihenes', band: 'critical' }])).toBe('az alvás kér figyelmet')
  expect(needsAttentionLine([{ key: 'mozgas', band: 'red' }, { key: 'rend', band: 'critical' }])).toBeNull()
  expect(needsAttentionLine([{ key: 'mozgas', band: 'green' }])).toBeNull()
})
