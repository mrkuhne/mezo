import { patterns, predictions, experiments, weekly, memoir, recentlyConfirmed, MIN_PATTERN_CONFIDENCE, patternCategoryColor } from '@/data/insights/insights'

test('three patterns, all above the confidence floor', () => {
  expect(patterns).toHaveLength(3)
  expect(patterns.every((p) => p.confidence >= MIN_PATTERN_CONFIDENCE)).toBe(true)
  expect(patterns[0].title).toBe('Reta beadás + 36h ablakban étvágy lefulladás')
  expect(patterns[0].critique.actionability).toBe(0.88)
})

test('pattern category colour maps to a --cat-* token', () => {
  expect(patternCategoryColor('response')).toBe('var(--cat-response)')
})

test('weekly review + memoir + recently-confirmed copy is verbatim', () => {
  expect(weekly.score).toBe(82)
  expect(weekly.items).toHaveLength(4)
  expect(memoir.title).toBe('Egy hét amikor a tested megtanult várni')
  expect(memoir.anchors).toHaveLength(3)
  expect(recentlyConfirmed).toHaveLength(3)
})

test('predictions + experiments shapes', () => {
  expect(predictions).toHaveLength(4)
  expect(predictions.find((p) => p.status === 'validated')?.actual).toBe('RPE 8.2 · vacsora 20:50')
  expect(experiments.find((e) => e.status === 'active')?.day).toBe(4)
})
