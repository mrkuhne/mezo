import { notificationFeedSeed } from '@/data/notification/feedMock'

// mezo-ms9a: KnowledgePage retired — the fact_candidate / fact_reinforced deeplinks used to
// point at the dead `/insights/knowledge` (never a real route). They now point at the unified
// Tudástár, matching the `/me/knowledge` → `/mezo/knowledge` router redirect target.
test('knowledge-related deeplinks point at the unified Tudástár, not the retired /insights/knowledge', () => {
  const knowledgeItems = notificationFeedSeed.filter((n) => n.kind === 'fact_candidate' || n.kind === 'fact_reinforced')
  expect(knowledgeItems.length).toBeGreaterThan(0)
  for (const item of knowledgeItems) {
    expect(item.deeplink).toBe('/mezo/knowledge')
  }
  expect(notificationFeedSeed.some((n) => n.deeplink === '/insights/knowledge')).toBe(false)
})
