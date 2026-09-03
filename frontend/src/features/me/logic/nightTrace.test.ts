import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  clearAllNightWake, clearNightWake, readNightWake, recordNightWake, traceDateFor,
} from '@/features/me/logic/nightTrace'
import { setCurrentUserId } from '@/shared/lib/userScope'

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
    localStorage.setItem('mezo.anon.night-wake:2026-07-19', JSON.stringify({ count: 1, lastAt: 'x' }))
    localStorage.setItem('mezo.anon.night-wake:2026-07-23', JSON.stringify({ count: 1, lastAt: 'x' }))
    recordNightWake()
    expect(localStorage.getItem('mezo.anon.night-wake:2026-07-19')).toBeNull()
    expect(readNightWake('2026-07-23')).not.toBeNull()
  })

  test('corrupt stored JSON reads as null', () => {
    localStorage.setItem('mezo.anon.night-wake:2026-07-24', 'not-json')
    expect(readNightWake('2026-07-24')).toBeNull()
  })

  // mezo-qw37.1 review Finding 2: night-wake trace is real personal data (count + timestamp of
  // overnight wakes), so it must not survive a sign-out on a shared device — the next account to
  // log in must neither see it nor have it silently prefilled into THEIR sleep log.
  test('clearAllNightWake removes every night-wake key and leaves other keys alone', () => {
    recordNightWake(new Date('2026-07-24T03:00:00'))
    recordNightWake(new Date('2026-07-23T03:00:00'))
    localStorage.setItem('mezo-theme', 'dark')
    clearAllNightWake()
    expect(readNightWake('2026-07-24')).toBeNull()
    expect(readNightWake('2026-07-23')).toBeNull()
    expect(localStorage.getItem('mezo-theme')).toBe('dark')
  })

  // Review Finding 2 (Task 10 fix round 1): clearAllNightWake is an unconditional prefix-scan
  // delete with NO date guard, run on every sign-out. The test above only proves an unrelated
  // key (mezo-theme) survives — it says nothing about an over-broad prefix, which is the actual
  // risk on a shared device: account B's night-wake trace must never be swept by account A's
  // sign-out. Seed a FOREIGN user's key and assert it survives.
  test('clearAllNightWake leaves other users\' night-wake keys alone', () => {
    setCurrentUserId('u1')
    recordNightWake(new Date('2026-07-24T03:00:00'))
    localStorage.setItem('mezo.other.night-wake:2026-07-24', JSON.stringify({ count: 1, lastAt: 'x' }))
    clearAllNightWake()
    expect(readNightWake('2026-07-24')).toBeNull()
    expect(localStorage.getItem('mezo.other.night-wake:2026-07-24')).not.toBeNull()
  })

  // Review Finding 1 (Task 10 fix round 1): the original version of this test seeded only a
  // foreign key and asserted it survives a same-scope recordNightWake — but that assertion
  // can't fail either against the OLD un-namespaced code (its bare `mezo-night-wake:` prefix
  // never matches `mezo.other.…` in the first place) or against an OVER-BROAD prefix like
  // `'mezo.'` (`'mezo.other.night-wake:2026-07-19'.slice(5)` is `'other.…'`, and `'o' > '2'`, so
  // the `< cutoffIso` date comparison rejects it regardless of the prefix's width). Seeding the
  // foreign AND the own key under the SAME stale date, then asserting the own one is pruned
  // while the foreign one survives, discriminates all three implementations: a bare prefix
  // wouldn't match the own key either (leaving it un-pruned, test fails), an over-broad prefix
  // would prune BOTH (foreign key gone, test fails), and only the correctly-scoped prefix prunes
  // the own key and spares the foreign one.
  test('a prune csak a saját user kulcsait takarítja', () => {
    setCurrentUserId('u1')
    localStorage.setItem('mezo.other.night-wake:2026-07-19', JSON.stringify({ count: 1, lastAt: 'x' }))
    localStorage.setItem('mezo.u1.night-wake:2026-07-19', JSON.stringify({ count: 1, lastAt: 'x' }))
    recordNightWake()
    expect(localStorage.getItem('mezo.other.night-wake:2026-07-19')).not.toBeNull()
    expect(localStorage.getItem('mezo.u1.night-wake:2026-07-19')).toBeNull()
  })
})
