import { test, expect } from 'vitest'
import type { MealBreakdown, ContextDimension } from '@/data/types'
import { mealContextOf } from '@/features/fuel/logic/mealContext'
import { fuelEtkezesHu } from '@/shared/i18n/messages/fuel-etkezes.hu'
import { fuelEtkezesEn } from '@/shared/i18n/messages/fuel-etkezes.en'

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
// The module's English label map („Pre-workout" on a Hungarian screen) left with Folyadék F5: the role's word is a catalog
// entry, in both languages, and `standard` prints nothing.
test('the role words live in the catalog, in both languages', () => {
  expect(fuelEtkezesHu.meal.ctx).toEqual({ pre: 'edzés előtti', post: 'edzés utáni' })
  expect(fuelEtkezesEn.meal.ctx).toEqual({ pre: 'before training', post: 'after training' })
})
test('an English envelope names the row Role — same prefixes (F5: stored in the account language)', () => {
  expect(mealContextOf({ breakdown: ctx([{ label: 'Role', value: 'Pre-workout fuel window' }]) })).toBe('pre')
  expect(mealContextOf({ breakdown: ctx([{ label: 'Role', value: 'Post-workout recovery' }]) })).toBe('post')
})
