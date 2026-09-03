import { test, expect } from 'vitest'
import { formatImpact } from '@/features/fuel/logic/formatImpact'

test('"+0.04 score" → "+4 pont", "−0.02 score" → "−2 pont", "-0.1 score" → "−10 pont"', () => {
  expect(formatImpact('+0.04 score')).toBe('+4 pont')
  expect(formatImpact('−0.02 score')).toBe('−2 pont')
  expect(formatImpact('-0.1 score')).toBe('−10 pont')
})
test('free text is passed through untouched', () => {
  expect(formatImpact('Mg-status 32% → 48%')).toBe('Mg-status 32% → 48%')
})
