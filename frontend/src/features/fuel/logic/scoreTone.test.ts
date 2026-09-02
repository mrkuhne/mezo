import { test, expect } from 'vitest'
import { toneOf } from '@/features/fuel/logic/scoreTone'

test('80+ is jó, 60–79 közepes, below 60 gyenge — the MealScoreChip thresholds', () => {
  expect(toneOf(80)).toEqual({ tone: 'hi', cls: 's-hi', word: 'jó' })
  expect(toneOf(79)).toEqual({ tone: 'md', cls: 's-md', word: 'közepes' })
  expect(toneOf(60)).toEqual({ tone: 'md', cls: 's-md', word: 'közepes' })
  expect(toneOf(59)).toEqual({ tone: 'lo', cls: 's-lo', word: 'gyenge' })
})
