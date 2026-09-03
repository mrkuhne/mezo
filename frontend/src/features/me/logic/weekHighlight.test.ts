import { describe, expect, test } from 'vitest'
import { highlightChip, highlightChips } from '@/features/me/logic/weekHighlight'
import type { WeeklyReviewDigest } from '@/data/me/weeklyReviewHooks'

const digest: WeeklyReviewDigest = {
  patterns: [{ pairKey: 'sleep_workout', title: 'Edzésnapokon jobban alszol', event: 'confirmed' }],
  newFacts: [], lifeEvents: [], memoir: true, predictions: [],
}

describe('weekly-review highlights -> anchor chips', () => {
  test('a Pattern highlight deep-links through the digest pairKey (the /mezo route, not /insights)', () => {
    const chip = highlightChip({ kind: 'Pattern', label: 'Edzésnapokon jobban alszol' }, digest)
    expect(chip).toMatchObject({ kindLabel: 'Minta', tone: 'lav', icon: 'i-minta', to: '/mezo/patterns/sleep_workout' })
  })

  test('an unmatched Pattern falls back to the Minták index rather than inventing a pair key', () => {
    expect(highlightChip({ kind: 'Pattern', label: 'Valami más' }, digest)?.to).toBe('/mezo/patterns')
    expect(highlightChip({ kind: 'Pattern', label: 'Edzésnapokon jobban alszol' }, null)?.to).toBe('/mezo/patterns')
  })

  test('Fact / LifeEvent / Memory map to their Mezo-tab pages', () => {
    expect(highlightChip({ kind: 'Fact', label: 'x' }, digest)).toMatchObject({ kindLabel: 'Tudás', tone: 'gold', to: '/mezo/knowledge' })
    expect(highlightChip({ kind: 'LifeEvent', label: 'x' }, digest)).toMatchObject({ kindLabel: 'Életesemény', tone: 'sky', to: '/mezo/knowledge' })
    expect(highlightChip({ kind: 'Memory', label: 'x' }, digest)).toMatchObject({ kindLabel: 'Emlék', tone: 'rose', to: '/mezo/memoir' })
  })

  test('an unknown kind is dropped, never rendered with a guessed colour and destination', () => {
    expect(highlightChip({ kind: 'Prophecy', label: 'x' }, digest)).toBeNull()
    expect(highlightChips([{ kind: 'Fact', label: 'a' }, { kind: 'Prophecy', label: 'b' }], digest)).toHaveLength(1)
  })

  test('no highlights -> no chips', () => {
    expect(highlightChips(undefined, digest)).toEqual([])
    expect(highlightChips([], digest)).toEqual([])
  })
})
