import { expect, test } from 'vitest'
import { goalWeekSentence } from '@/features/me/logic/goalWeekSentence'
import type { LifeGoalTodaySummary } from '@/data/lifegoal/lifegoalApi'

const base: LifeGoalTodaySummary = {
  goalId: 'g1', title: 'Kockahas', dimension: 'health', arrow: 'up',
  days7: ['hit', 'hit', 'partial', 'hit', 'miss', 'hit', 'no_data'],
  pillarsTotal: 3, pillarsHitToday: 2,
}

test('teli hét: találat-nap szám + mai pillér-arány', () => {
  expect(goalWeekSentence(base)).toBe('4 találat-nap a 7-ből · ma 2 / 3 pillér.')
})

test('insufficient nyíl: nem irány, hanem adat-hiány', () => {
  expect(goalWeekSentence({ ...base, arrow: 'insufficient' }))
    .toBe('Még kevés az adat az irányhoz — 4 találat-nap a 7-ből.')
})

test('nincs pillér-szám: a mai arány kimarad, nem lesz 0 / 0', () => {
  expect(goalWeekSentence({ ...base, pillarsTotal: undefined, pillarsHitToday: undefined }))
    .toBe('4 találat-nap a 7-ből.')
})

test('csupa no_data: nulla találat-napot sem állít', () => {
  expect(goalWeekSentence({ ...base, arrow: 'insufficient', days7: ['no_data', 'no_data'], pillarsTotal: undefined, pillarsHitToday: undefined }))
    .toBe('Ezen a héten még nincs adata.')
})
