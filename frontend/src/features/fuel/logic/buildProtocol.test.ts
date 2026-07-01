import { buildProtocol } from '@/features/fuel/logic/buildProtocol'
import { supplementsStash } from '@/data/fuel/fuel'

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
