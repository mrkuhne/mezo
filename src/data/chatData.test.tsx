import { initialChat } from './chat'

test('seeds the conversation (assistant → user → assistant) with tool transparency', () => {
  expect(initialChat).toHaveLength(3)
  expect(initialChat[0].role).toBe('assistant')
  expect(initialChat[0].tools?.[0]).toEqual({ type: 'read', name: 'get_recent_workouts(days=3)' })
  expect(initialChat[0].refs?.[0]).toEqual({ kind: 'Workout', id: 'w-2026-05-21' })
  expect(initialChat[1].role).toBe('user')
  expect(initialChat[1].text).toBe('Aludtam 7h-t. Érzem hogy ma jobb mint tegnap.')
  expect(initialChat[2].role).toBe('assistant')
  expect(initialChat[2].refs?.[1]).toEqual({ kind: 'SleepLog', id: 'sleep-2026-05-21' })
})
