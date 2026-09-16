import { expect, test } from 'vitest'
import { SPORT_KINDS, SPORT_LABELS, SPORT_TAGS, SPORT_TITLES, SPORT_EMOJI, SPORT_TONE, sportOf } from '@/features/train/logic/sportKinds'

test('SPORT_KINDS carries all ten wire sport ids', () => {
  expect(SPORT_KINDS).toEqual([
    'volleyball', 'cross', 'trx', 'bike', 'swim', 'football', 'basketball', 'tennis', 'hike', 'other',
  ])
})

test('cross and trx keep their own tone; every other kind wears the generic sport tone', () => {
  expect(SPORT_TONE.cross).toBe('cross')
  expect(SPORT_TONE.trx).toBe('trx')
  for (const k of SPORT_KINDS) if (k !== 'cross' && k !== 'trx') expect(SPORT_TONE[k]).toBe('sport')
})

test('the tone map covers every kind in SPORT_KINDS', () => {
  for (const k of SPORT_KINDS) expect(SPORT_TONE[k]).toBeTruthy()
})

test('every kind has a non-empty label/tag/title/emoji', () => {
  for (const k of SPORT_KINDS) {
    expect(SPORT_LABELS[k]).toBeTruthy()
    expect(SPORT_TAGS[k]).toBeTruthy()
    expect(SPORT_TITLES[k]).toBeTruthy()
    expect(SPORT_EMOJI[k]).toBeTruthy()
  }
})

test('an undiscriminated slot resolves to volleyball, hence the sport tone', () => {
  expect(SPORT_TONE[sportOf({})]).toBe('sport')
})

test('sportOf narrows to a caller-supplied narrower sport type, not the widened one', () => {
  // A schedule slot's sport is still the 3-id union (schedule CHECK unchanged) — sportOf
  // must hand that narrower type straight back, not widen it to all ten kinds.
  const slot: { sport?: 'volleyball' | 'cross' | 'trx' } = { sport: 'trx' }
  const kind = sportOf(slot)
  expect(kind).toBe('trx')
  const check: 'volleyball' | 'cross' | 'trx' = kind
  expect(check).toBe('trx')
})
