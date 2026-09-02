import { test, expect } from 'vitest'
import type { MealBreakdown, ContextDimension } from '@/data/types'
import { mealContextOf, MEAL_CONTEXT_LABEL } from '@/features/fuel/logic/mealContext'

const ctx = (rows: { label: string; value: string }[]): MealBreakdown => ({
  confidence: 0.8, summary: null, tagline: null, improve: [], tools: [],
  dimensions: [{ id: 'context', label: 'Időzítés', weight: 0.2, score: 0.5, color: 'x', detail: '', context: rows } as ContextDimension],
})

test('no breakdown → null (unscored meal carries no chip)', () => {
  expect(mealContextOf({ breakdown: undefined })).toBeNull()
})
test('scored without a Szerep row → standard', () => {
  expect(mealContextOf({ breakdown: ctx([{ label: 'Időzítés', value: '13:30 · Ebéd ablakban' }]) })).toBe('standard')
})
test('Szerep prefix Pre-workout → pre, Post-workout → post (server label may grow a suffix)', () => {
  expect(mealContextOf({ breakdown: ctx([{ label: 'Szerep', value: 'Pre-workout üzemanyag-ablak' }]) })).toBe('pre')
  expect(mealContextOf({ breakdown: ctx([{ label: 'Szerep', value: 'Post-workout regeneráció' }]) })).toBe('post')
})
test('an unknown Szerep value falls back to standard', () => {
  expect(mealContextOf({ breakdown: ctx([{ label: 'Szerep', value: 'Általános' }]) })).toBe('standard')
})
test('labels', () => {
  expect(MEAL_CONTEXT_LABEL).toEqual({ standard: 'Standard', pre: 'Pre-workout', post: 'Post-workout' })
})
