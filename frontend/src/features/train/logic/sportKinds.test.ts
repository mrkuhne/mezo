import { expect, test } from 'vitest'
import { SPORT_KINDS, SPORT_TONE, sportOf } from '@/features/train/logic/sportKinds'

test('every sport kind maps to its own tone', () => {
  expect(SPORT_TONE).toEqual({ volleyball: 'sport', cross: 'cross', trx: 'trx' })
})

test('the tone map covers every kind in SPORT_KINDS', () => {
  for (const k of SPORT_KINDS) expect(SPORT_TONE[k]).toBeTruthy()
})

test('an undiscriminated slot resolves to volleyball, hence the sport tone', () => {
  expect(SPORT_TONE[sportOf({})]).toBe('sport')
})
