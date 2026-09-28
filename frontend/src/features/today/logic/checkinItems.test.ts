import { describe, expect, test } from 'vitest'
import { answerText, answeredItems, ratingBand, scoreRatingBand } from '@/features/today/logic/checkinItems'

describe('answerText (prototype ckDisp)', () => {
  const values = {
    energy: 7, mood: null, pain: { regions: ['TERD' as const, 'DEREK' as const], intensity: 4 },
    craving: { value: 6, kinds: ['EDES' as const, 'SOS' as const] }, soreness: 3,
  }
  test('not asked = null, skipped = —, answered = the value', () => {
    expect(answerText('hunger', values)).toBeNull()
    expect(answerText('mood', values)).toBe('—')
    expect(answerText('energy', values)).toBe('7')
  })
  test('pain and craving read long in the summary, short in a cell', () => {
    expect(answerText('pain', values)).toBe('Térd, Derék · 4/10')
    expect(answerText('pain', values, true)).toBe('Térd 4')
    expect(answerText('pain', { pain: false })).toBe('Nem')
    expect(answerText('craving', values)).toBe('6 · Édes, Sós')
    expect(answerText('craving', values, true)).toBe('Édes 6')
    expect(answerText('craving', { craving: { value: 2, kinds: [] } }, true)).toBe('2')
  })
  test('answeredItems keeps the ask order and drops skipped items', () => {
    expect(answeredItems(values, ['soreness', 'energy', 'mood', 'pain'])).toEqual(['soreness', 'energy', 'pain'])
    expect(answeredItems(values)).toEqual(['energy', 'soreness', 'pain', 'craving'])
  })
})

describe('day bands', () => {
  test('the evening verdict: 1–4 rossz, 5–6 közepes, 7–8 jó, 9–10 nagyon jó', () => {
    expect([1, 4, 5, 6, 7, 8, 9, 10].map(ratingBand)).toEqual(
      ['rossz', 'rossz', 'közepes', 'közepes', 'jó', 'jó', 'nagyon jó', 'nagyon jó'])
  })
  test('the app score on the same scale (64 → közepes, the prototype pair)', () => {
    expect(scoreRatingBand(64)).toBe('közepes')
    expect(scoreRatingBand(72)).toBe('jó')
    expect(scoreRatingBand(91)).toBe('nagyon jó')
    expect(scoreRatingBand(30)).toBe('rossz')
  })
})
