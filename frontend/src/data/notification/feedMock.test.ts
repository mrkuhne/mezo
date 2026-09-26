import { notificationFeedSeed } from '@/data/notification/feedMock'

// mezo-ms9a: KnowledgePage retired — the fact_candidate / fact_reinforced deeplinks used to
// point at the dead `/insights/knowledge` (never a real route). fact_reinforced (an already-
// reinforced fact, not a pending decision) still lands on the unified Tudástár.
test('fact_reinforced deeplinks point at the unified Tudástár, not the retired /insights/knowledge', () => {
  const reinforced = notificationFeedSeed.filter((n) => n.kind === 'fact_reinforced')
  expect(reinforced.length).toBeGreaterThan(0)
  for (const item of reinforced) {
    expect(item.deeplink).toBe('/mezo/knowledge')
  }
  expect(notificationFeedSeed.some((n) => n.deeplink === '/insights/knowledge')).toBe(false)
})

// Task 11 (mezo-zpxv7): fact_candidate / graph_candidate are "decide" notifications — a
// candidate is decided on the Rólad page now, so their deeplinks point there instead of the
// Tudástár (where the inbox used to live).
test('fact_candidate / graph_candidate deeplinks point at the Rólad decision inbox', () => {
  const decideItems = notificationFeedSeed.filter((n) => n.kind === 'fact_candidate' || n.kind === 'graph_candidate')
  expect(decideItems.length).toBeGreaterThan(0)
  for (const item of decideItems) {
    expect(item.deeplink).toBe('/mezo/rolad')
  }
})
