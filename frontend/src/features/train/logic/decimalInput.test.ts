import { expect, it } from 'vitest'
import { formatDecimal, parseDecimal } from '@/features/train/logic/decimalInput'

it.each([
  ['97,5', 97.5], ['97.5', 97.5], ['101,25', 101.25], ['2,5', 2.5], ['95', 95],
  ['97,', 97], [',5', 0.5], [' 60 ', 60],
])('parses %s', (text, expected) => {
  expect(parseDecimal(text)).toBe(expected)
})

it.each(['', ',', '.', 'abc', '9,5,5', '-5', '1e3'])('rejects %j', (text) => {
  expect(parseDecimal(text)).toBeNull()
})

it('formats with the HU comma', () => {
  expect(formatDecimal(97.5)).toBe('97,5')
  expect(formatDecimal(105)).toBe('105')
})
