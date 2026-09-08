import { patterns, predictions, experiments, memoir, recentlyConfirmed, MIN_PATTERN_CONFIDENCE, patternCategoryColor } from '@/data/insights/insights'

test('three scored hypotheses above the confidence floor, plus the reflection row', () => {
  expect(patterns).toHaveLength(4)
  // A `confidence` a KRITIKA pontszáma — csak a hipotézis-sorokon értelmes. A reflexiós sor
  // (mezo-eq85.6) bizonyossága a determinisztikus `belief`, ezért a küszöb rá nem vonatkozik.
  const scored = patterns.filter((p) => p.confidence != null)
  expect(scored).toHaveLength(3)
  expect(scored.every((p) => (p.confidence ?? 0) >= MIN_PATTERN_CONFIDENCE)).toBe(true)
  const reflection = patterns.find((p) => p.kind === 'reflection')!
  expect(reflection.testPlan?.minN).toBe(8)
  expect(reflection.belief).toBe(0.38)
  expect(patterns[0].title).toBe('Magas sportterhelés → rákövetkező éjjel mélyebb alvás')
  expect(patterns[0].critique?.actionability).toBe(0.88)
})

test('pattern category colour maps to a --cat-* token', () => {
  expect(patternCategoryColor('response')).toBe('var(--cat-response)')
})

test('memoir + recently-confirmed copy is verbatim', () => {
  expect(memoir.title).toBe('Egy hét amikor a tested megtanult várni')
  expect(memoir.anchors).toHaveLength(3)
  expect(recentlyConfirmed).toHaveLength(3)
})

test('predictions + experiments shapes', () => {
  expect(predictions).toHaveLength(4)
  expect(predictions.find((p) => p.status === 'validated')?.actual).toBe('RPE 8.2 · vacsora 20:50')
  expect(experiments.find((e) => e.status === 'active')?.day).toBe(4)
})
