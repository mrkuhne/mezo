import { expect, test } from 'vitest'
import { courseCopy, dietExplanation } from '@/features/me/logic/goalOverviewCopy'

test.each([
  ['on_track', 'rate_on_track', 'Jó úton haladsz'],
  ['watch', 'rate_off_track', 'Figyelmet kér'],
  ['learning', 'trend_missing', 'Még tanulom az ütemed'],
  ['invalid', 'goal_invalid', 'A cél beállítása hibás'],
] as const)('courseCopy maps %s to stable Hungarian UI copy', (status, reason, heading) => {
  expect(courseCopy(status, reason).heading).toBe(heading)
})

test('courseCopy keeps a safe explanation for an unknown reason code', () => {
  expect(courseCopy('watch', 'future_reason').body).toMatch(/eltér/)
})

test.each([
  ['training_day_split', 'edzésnap'],
  ['rest_day_split', 'pihenőnap'],
  ['uniform_kcal', 'egységes'],
  ['goal_invalid', 'javítani'],
] as const)('dietExplanation maps %s without exposing wire codes', (code, fragment) => {
  expect(dietExplanation(code).toLocaleLowerCase('hu-HU')).toContain(fragment)
})
