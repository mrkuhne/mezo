import { formatGram } from '@/shared/lib/grams'

test('formatGram prints Hungarian decimals, drops a trailing zero, and dashes a null', () => {
  expect(formatGram(6)).toBe('6')
  expect(formatGram(6.0)).toBe('6')
  expect(formatGram(0.4)).toBe('0,4')
  expect(formatGram(12.45)).toBe('12,5')
  expect(formatGram(null)).toBe('—')
  expect(formatGram(undefined)).toBe('—')
})

// Since the storage precision went to three decimals (the user's 2026-08-11 ruling), a real but tiny
// value reaches the display layer. Printing "0" for it would read as "no salt", which is the same lie
// as printing 0 for a null — so it gets its own marker. An honest 0 still prints as 0.
test('formatGram marks a present-but-sub-0,1 value instead of printing it as zero', () => {
  expect(formatGram(0.04)).toBe('<0,1')
  expect(formatGram(0.001)).toBe('<0,1')
  expect(formatGram(0)).toBe('0')
})
