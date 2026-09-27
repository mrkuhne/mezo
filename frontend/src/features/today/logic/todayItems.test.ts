import { expect, test } from 'vitest'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import type { CheckinSlot } from '@/data/types'

const slot = (time: string, state: CheckinSlot['state']): CheckinSlot =>
  ({ time, state, values: null, note: null })

test('isFillableSlot — everything but an already recorded slot', () => {
  expect([slot('06:30', 'done'), slot('10:00', 'skipped'), slot('14:00', 'now'), slot('20:00', 'pending')]
    .map(isFillableSlot)).toEqual([false, true, true, true])
})
