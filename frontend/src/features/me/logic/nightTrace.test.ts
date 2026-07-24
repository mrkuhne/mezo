import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  clearNightWake, readNightWake, recordNightWake, traceDateFor,
} from '@/features/me/logic/nightTrace'

describe('nightTrace', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-24T03:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  test('traceDateFor: after 18:00 the wake belongs to TOMORROW morning', () => {
    expect(traceDateFor(new Date('2026-07-24T23:30:00'))).toBe('2026-07-25')
    expect(traceDateFor(new Date('2026-07-24T03:00:00'))).toBe('2026-07-24')
    expect(traceDateFor(new Date('2026-07-24T17:59:00'))).toBe('2026-07-24')
  })

  test('record + read + increment', () => {
    recordNightWake()
    expect(readNightWake('2026-07-24')).toMatchObject({ count: 1 })
    recordNightWake()
    expect(readNightWake('2026-07-24')).toMatchObject({ count: 2 })
    expect(readNightWake('2026-07-23')).toBeNull()
  })

  test('clear removes the entry', () => {
    recordNightWake()
    clearNightWake('2026-07-24')
    expect(readNightWake('2026-07-24')).toBeNull()
  })

  test('recording prunes entries older than 3 days', () => {
    localStorage.setItem('mezo-night-wake:2026-07-19', JSON.stringify({ count: 1, lastAt: 'x' }))
    localStorage.setItem('mezo-night-wake:2026-07-23', JSON.stringify({ count: 1, lastAt: 'x' }))
    recordNightWake()
    expect(localStorage.getItem('mezo-night-wake:2026-07-19')).toBeNull()
    expect(readNightWake('2026-07-23')).not.toBeNull()
  })

  test('corrupt stored JSON reads as null', () => {
    localStorage.setItem('mezo-night-wake:2026-07-24', 'not-json')
    expect(readNightWake('2026-07-24')).toBeNull()
  })
})
