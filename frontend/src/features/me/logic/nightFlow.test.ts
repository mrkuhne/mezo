import { describe, expect, test } from 'vitest'
import { NIGHT_WATCHDOG_MIN, watchdogDone } from '@/features/me/logic/nightFlow'

describe('watchdogDone', () => {
  const MIN = 60_000
  test('false before the 20-minute mark', () => {
    expect(watchdogDone(0, (NIGHT_WATCHDOG_MIN - 1) * MIN)).toBe(false)
  })
  test('true at and after the 20-minute mark', () => {
    expect(watchdogDone(0, NIGHT_WATCHDOG_MIN * MIN)).toBe(true)
    expect(watchdogDone(0, NIGHT_WATCHDOG_MIN * MIN + 5 * MIN)).toBe(true)
  })
  test('survives a large sleep gap (timestamp-based, not tick-counted)', () => {
    const start = 1_000_000
    expect(watchdogDone(start, start + 3 * 60 * MIN)).toBe(true)
  })
})
