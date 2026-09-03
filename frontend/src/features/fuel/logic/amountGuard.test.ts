import { describe, expect, test } from 'vitest'
import { parseAmountInput, stepAmount } from '@/features/fuel/logic/amountGuard'

describe('parseAmountInput', () => {
  test('accepts a positive finite number', () => {
    expect(parseAmountInput('120', 50)).toBe(120)
  })
  test('accepts a comma decimal', () => {
    expect(parseAmountInput('1,5', 1)).toBe(1.5)
  })
  test.each(['', 'abc', '0', '-5', 'NaN'])('keeps the previous value for invalid input %s', (raw) => {
    expect(parseAmountInput(raw, 42)).toBe(42)
  })
})

describe('stepAmount', () => {
  test('adds the delta', () => {
    expect(stepAmount(100, 10)).toBe(110)
  })
  test('never drops below min', () => {
    expect(stepAmount(5, -10)).toBe(1)
    expect(stepAmount(5, -10, 0)).toBe(0)
  })
})
