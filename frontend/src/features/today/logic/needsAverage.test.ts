import { expect, test } from 'vitest'
import { needNameInSentence, needsAttention, needsAttentionLine, needsAverage } from '@/features/today/logic/needsAverage'

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

test('a need asks for attention in the red and the critical band only', () => {
  expect((['green', 'yellow', 'red', 'critical'] as const).map((band) => needsAttention({ band }))).toEqual([false, false, true, true])
})

test('the name of a need inside a sentence carries its article', () => {
  expect((['energia', 'hidratacio', 'pihenes', 'mozgas', 'lelek', 'rend'] as const).map(needNameInSentence))
    .toEqual(['az étel', 'a víz', 'az alvás', 'a mozgás', 'a kapcsolat', 'a rend'])
})
