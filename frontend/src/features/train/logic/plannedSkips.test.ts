import { expect, test } from 'vitest'
import { findSkip, isSkipped, isSportSlotSkipped, judge, skipWindow, type PlannedSkip, type PlannedSkipKey } from '@/features/train/logic/plannedSkips'

const gymKey = (date: string): PlannedSkipKey => ({ kind: 'GYM', date })
const sportKey = (date: string, dayOfWeek: number, time: string): PlannedSkipKey => ({ kind: 'SPORT', date, dayOfWeek, time })
const runKey = (date: string, sessionKey: string): PlannedSkipKey => ({ kind: 'RUN', date, sessionKey })

test('isSkipped matches GYM on kind + date alone', () => {
  const skips: PlannedSkipKey[] = [gymKey('2026-09-28')]
  expect(isSkipped(skips, gymKey('2026-09-28'))).toBe(true)
  expect(isSkipped(skips, gymKey('2026-09-29'))).toBe(false)
  expect(isSkipped(skips, sportKey('2026-09-28', 1, '18:00'))).toBe(false)
})

test('isSkipped matches SPORT on kind + date + dayOfWeek + time', () => {
  const skips: PlannedSkipKey[] = [sportKey('2026-09-28', 1, '18:00')]
  expect(isSkipped(skips, sportKey('2026-09-28', 1, '18:00'))).toBe(true)
  // same day + date, different time -> miss
  expect(isSkipped(skips, sportKey('2026-09-28', 1, '20:00'))).toBe(false)
  // same day + time, different date -> miss
  expect(isSkipped(skips, sportKey('2026-09-29', 1, '18:00'))).toBe(false)
})

test('isSkipped matches RUN on kind + date + sessionKey', () => {
  const skips: PlannedSkipKey[] = [runKey('2026-09-28', 'w1-run1')]
  expect(isSkipped(skips, runKey('2026-09-28', 'w1-run1'))).toBe(true)
  expect(isSkipped(skips, runKey('2026-09-28', 'w1-run2'))).toBe(false)
})

test('findSkip returns the matching row, preserving extra fields', () => {
  const row: PlannedSkip = {
    kind: 'GYM', date: '2026-09-28', id: 'a1', reasonCategory: 'NONE',
    source: 'USER', serious: false, freePass: true, excused: true,
  }
  expect(findSkip([row], gymKey('2026-09-28'))).toBe(row)
  expect(findSkip([row], gymKey('2026-09-29'))).toBeUndefined()
})

test('isSportSlotSkipped is the SPORT-only re-export shape existing callers use', () => {
  const skips: PlannedSkipKey[] = [sportKey('2026-09-28', 1, '18:00'), gymKey('2026-09-28')]
  expect(isSportSlotSkipped(skips, 1, '18:00', '2026-09-28')).toBe(true)
  expect(isSportSlotSkipped(skips, 1, '20:00', '2026-09-28')).toBe(false)
})

function row(over: Partial<PlannedSkip> & Pick<PlannedSkip, 'id' | 'date' | 'reasonCategory' | 'source' | 'createdAt'>): PlannedSkip {
  return {
    kind: 'GYM', serious: false, freePass: false, excused: false,
    ...over,
  }
}

test('judge: a serious row is excused but never gets the free pass', () => {
  const [v] = judge([row({ id: '1', date: '2026-09-28', reasonCategory: 'ILLNESS', source: 'USER', createdAt: '2026-09-28T10:00:00Z' })])
  expect(v.serious).toBe(true)
  expect(v.excused).toBe(true)
  expect(v.freePass).toBe(false)
})

test('judge: two soft USER rows same ISO week — first (by createdAt) gets the pass, second does not', () => {
  const [v1, v2] = judge([
    row({ id: '1', date: '2026-09-28', reasonCategory: 'NONE', source: 'USER', createdAt: '2026-09-28T10:00:00Z' }),
    row({ id: '2', date: '2026-09-28', reasonCategory: 'OTHER', source: 'USER', createdAt: '2026-09-28T11:00:00Z' }),
  ])
  expect(v1.freePass).toBe(true)
  expect(v1.excused).toBe(true)
  expect(v2.freePass).toBe(false)
  expect(v2.excused).toBe(false)
})

test('judge: sorts by createdAt then id regardless of input order — output order matches input', () => {
  const later = row({ id: '2', date: '2026-09-28', reasonCategory: 'OTHER', source: 'USER', createdAt: '2026-09-28T11:00:00Z' })
  const earlier = row({ id: '1', date: '2026-09-28', reasonCategory: 'NONE', source: 'USER', createdAt: '2026-09-28T10:00:00Z' })
  const [v0, v1] = judge([later, earlier])
  expect(v0.id).toBe('2')
  expect(v0.freePass).toBe(false)
  expect(v1.id).toBe('1')
  expect(v1.freePass).toBe(true)
})

test('judge: soft rows in different ISO weeks both get the pass', () => {
  const [v1, v2] = judge([
    row({ id: '1', date: '2026-09-27', reasonCategory: 'NONE', source: 'USER', createdAt: '2026-09-27T10:00:00Z' }), // Sunday, week 39
    row({ id: '2', date: '2026-09-28', reasonCategory: 'OTHER', source: 'USER', createdAt: '2026-09-28T11:00:00Z' }), // Monday, week 40
  ])
  expect(v1.freePass).toBe(true)
  expect(v2.freePass).toBe(true)
})

test('judge: a serious row never consumes the pass — the soft row still gets it', () => {
  const [serious, soft] = judge([
    row({ id: '1', date: '2026-09-28', reasonCategory: 'ILLNESS', source: 'USER', createdAt: '2026-09-28T10:00:00Z' }),
    row({ id: '2', date: '2026-09-28', reasonCategory: 'OTHER', source: 'USER', createdAt: '2026-09-28T11:00:00Z' }),
  ])
  expect(serious.serious).toBe(true)
  expect(serious.freePass).toBe(false)
  expect(soft.freePass).toBe(true)
  expect(soft.excused).toBe(true)
})

test('judge: an ADVICE row is always excused and never consumes the pass', () => {
  const [advice, soft] = judge([
    row({ id: '1', date: '2026-09-28', reasonCategory: 'NONE', source: 'ADVICE', createdAt: '2026-09-28T10:00:00Z' }),
    row({ id: '2', date: '2026-09-28', reasonCategory: 'OTHER', source: 'USER', createdAt: '2026-09-28T11:00:00Z' }),
  ])
  expect(advice.excused).toBe(true)
  expect(advice.freePass).toBe(false)
  expect(soft.freePass).toBe(true)
})

test('judge: an advice-backed USER row stays excused and leaves the pass for another soft skip', () => {
  const [backed, soft] = judge([
    row({ id: '1', date: '2026-09-28', reasonCategory: 'TIRED', source: 'USER', adviceBacked: true, createdAt: '2026-09-28T10:00:00Z' }),
    row({ id: '2', date: '2026-09-29', reasonCategory: 'TIRED', source: 'USER', createdAt: '2026-09-29T11:00:00Z' }),
  ])
  expect(backed.excused).toBe(true)
  expect(backed.freePass).toBe(false)
  expect(soft.freePass).toBe(true)
})

test('skipWindow: today-7 .. Sunday of this ISO week', () => {
  expect(skipWindow(new Date(2026, 8, 28))).toEqual({ fromIso: '2026-09-21', toIso: '2026-10-04' })
})
