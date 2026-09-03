import { expect, test } from 'vitest'
import {
  isSnoozed,
  morningWindow,
  offendingSlots,
  rescheduledSlots,
  snooze,
  snoozeHash,
  snoozeKey,
} from '@/features/train/logic/morningWindow'
import { setCurrentUserId } from '@/shared/lib/userScope'

const slots = [
  { dayOfWeek: 1, time: '18:30' },
  { dayOfWeek: 3, time: '07:50' },
]

test('morningWindow derives [wake+60m, wake+6h]', () => {
  expect(morningWindow('06:45')).toEqual({ start: '07:45', end: '12:45' })
  expect(morningWindow('06:00')).toEqual({ start: '07:00', end: '12:00' }) // ghost wake = the retired static 12:00
})

test('offendingSlots keeps only after-window-end slots — early-morning passes (spec D3)', () => {
  const w = morningWindow('06:45')
  expect(offendingSlots(slots, w)).toEqual([{ dayOfWeek: 1, time: '18:30' }])
  expect(offendingSlots([{ dayOfWeek: 0, time: '07:00' }], w)).toEqual([])
})

test('rescheduledSlots moves offenders to the window start, passes the rest', () => {
  const w = morningWindow('06:45')
  expect(rescheduledSlots(slots, w)).toEqual([
    { dayOfWeek: 1, time: '07:45' },
    { dayOfWeek: 3, time: '07:50' },
  ])
})

test('snooze is content-keyed: same state stays snoozed, changed state re-arms (spec D4)', () => {
  localStorage.removeItem(snoozeKey())
  const hash = snoozeHash('06:45', [{ dayOfWeek: 1, time: '18:30' }])
  expect(isSnoozed(hash)).toBe(false)
  snooze(hash)
  expect(isSnoozed(hash)).toBe(true)
  expect(isSnoozed(snoozeHash('06:30', [{ dayOfWeek: 1, time: '18:30' }]))).toBe(false)
  expect(isSnoozed(snoozeHash('06:45', [{ dayOfWeek: 2, time: '19:00' }]))).toBe(false)
})

test('a snooze user-névterezett', () => {
  const hash = snoozeHash('06:45', [{ dayOfWeek: 1, time: '18:30' }])
  setCurrentUserId('u1'); snooze(hash)
  setCurrentUserId('u2'); expect(isSnoozed(hash)).toBe(false)
})
