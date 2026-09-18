import { initialChat } from '@/data/insights/chat'

test('seeds the conversation (assistant → user → assistant) with tool transparency', () => {
  expect(initialChat).toHaveLength(3)
  expect(initialChat[0].role).toBe('assistant')
  // S9.7 (mezo-rj214.7): the seed carries the provenance card fields too, because the mock UI
  // path renders straight off this list. Widened, not loosened — still an exact-shape pin.
  expect(initialChat[0].tools?.[0]).toEqual({
    type: 'read',
    name: 'get_training_log(days=3)',
    why: 'Hogy lássam, mi volt az elmúlt napok edzésein.',
    outcome:
      'Tegnap Push Day: Lat Pulldown 105 kg × 9 @ RIR 1, Chest Press 80 kg × 8. Előtte szerdán pihenőnap.',
  })
  expect(initialChat[0].refs?.[0]).toEqual({ kind: 'Workout', id: 'w-2026-05-21' })
  expect(initialChat[1].role).toBe('user')
  expect(initialChat[1].text).toBe('Aludtam 7h-t. Érzem hogy ma jobb mint tegnap.')
  expect(initialChat[2].role).toBe('assistant')
  expect(initialChat[2].refs?.[1]).toEqual({ kind: 'SleepLog', id: 'sleep-2026-05-21' })
  // The scrubbed case (ask kept, result half gone) and the honest-failure case both live in the
  // seed so the demo surface shows what a 90-day-old row and a failed step actually look like.
  expect(initialChat[2].tools?.[0]).toEqual({
    type: 'read',
    name: 'get_recovery(days=7)',
    why: 'Hogy lássam a heti alvásodat.',
  })
  expect(initialChat[2].tools?.[2]?.failed).toBe(true)
})
