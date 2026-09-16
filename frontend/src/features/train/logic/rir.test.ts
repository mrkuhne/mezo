import { expect, test } from 'vitest'
import { RIR_VALUES, RIR_MAX } from './rir'

test('RIR_VALUES is the contract\'s full 0-5 range', () => {
  expect(RIR_VALUES).toEqual([0, 1, 2, 3, 4, 5])
})

test('RIR_MAX is the last value in RIR_VALUES', () => {
  expect(RIR_MAX).toBe(5)
})
