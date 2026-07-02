import { buildProtocol } from '@/features/fuel/logic/buildProtocol'
import { supplementsStash } from '@/data/fuel/fuel'
import type { SupplementStashItem } from '@/data/types'

test('builds a timed protocol from selected stash items', () => {
  const selected = supplementsStash.filter(s => s.type !== 'medication').map(s => s.id)
  const result = buildProtocol(selected, supplementsStash)
  expect(result.slots.length).toBeGreaterThan(0)
  expect(result.reasoning.length).toBeGreaterThan(0)
  expect(result.mealMatches.length).toBeGreaterThan(0)
})
test('empty selection yields empty slots', () => {
  expect(buildProtocol([], supplementsStash).slots).toHaveLength(0)
})

// --- Real-stash matching (UUID ids + catalog names, no mock slugs) ---
// In real mode the pantry stash carries backend UUID ids and the 147-item
// catalog's real Hungarian names, so slug-id rules (byId('kreatin')) all miss.
// buildProtocol must match on name/id substrings instead.
function mk(id: string, name: string): SupplementStashItem {
  return {
    id,
    name,
    brand: 'Test',
    type: 'supplement',
    category: 'test',
    dose: '1 adag',
    form: 'kapszula',
    stock: 10,
    stockUnit: 'db',
    protocol: 'test',
    timing: 'flexible',
    taken: false,
  }
}

const realStash: SupplementStashItem[] = [
  mk('11111111-1111-4111-8111-111111111111', 'Kreatin monohidrát'),
  mk('22222222-2222-4222-8222-222222222222', 'Koffein 200'),
  mk('33333333-3333-4333-8333-333333333333', 'D3 + K2 vitamin'),
  mk('44444444-4444-4444-8444-444444444444', 'Magnézium-biszglicinát'),
  mk('55555555-5555-4555-8555-555555555555', 'Omega-3'),
  mk('66666666-6666-4666-8666-666666666666', 'AAKG L-Arginine'),
  mk('77777777-7777-4777-8777-777777777777', 'Béta-alanin'),
  mk('88888888-8888-4888-8888-888888888888', 'Impact Whey Protein'),
]

test('real stash (UUID ids + catalog names) produces the same slot kinds as the slug stash', () => {
  const slugSel = supplementsStash.filter(s => s.type !== 'medication').map(s => s.id)
  const slugKinds = buildProtocol(slugSel, supplementsStash).slots.map(s => s.kind).sort()

  const realSel = realStash.map(s => s.id)
  const realKinds = buildProtocol(realSel, realStash).slots.map(s => s.kind).sort()

  expect(realKinds.length).toBeGreaterThan(0)
  expect(realKinds).toEqual(slugKinds)
})

test('every emitted protocol item carries its source stash refId', () => {
  const realSel = realStash.map(s => s.id)
  const built = buildProtocol(realSel, realStash)
  const validIds = new Set(realStash.map(s => s.id))
  const allItems = built.slots.flatMap(s => s.items)

  expect(allItems.length).toBeGreaterThan(0)
  for (const item of allItems) {
    expect(item.refId).toBeDefined()
    expect(validIds.has(item.refId)).toBe(true)
  }
})
