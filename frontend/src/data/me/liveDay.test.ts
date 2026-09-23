import { QueryClient } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { invalidateTodayDay } from '@/data/me/liveDay'

test('invalidateTodayDay marks today\'s evaluation and this week stale, nothing else', async () => {
  const qc = new QueryClient()
  const now = new Date(2026, 8, 24, 14, 20) // Thursday
  qc.setQueryData(['dayEvaluation', '2026-09-24'], { x: 1 })
  qc.setQueryData(['dayEvaluation', '2026-09-23'], { x: 1 })
  qc.setQueryData(['meWeek', '2026-09-21'], { x: 1 })
  await invalidateTodayDay(qc, now)
  expect(qc.getQueryState(['dayEvaluation', '2026-09-24'])?.isInvalidated).toBe(true)
  expect(qc.getQueryState(['meWeek', '2026-09-21'])?.isInvalidated).toBe(true)
  expect(qc.getQueryState(['dayEvaluation', '2026-09-23'])?.isInvalidated).toBe(false)
})
