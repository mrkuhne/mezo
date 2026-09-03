import { beforeEach, describe, expect, test, vi } from 'vitest'
import { lastSeenMessage, markMessagesSeen } from '@/shared/lib/seenMessages'
import { setCurrentUserId } from '@/shared/lib/userScope'

describe('seenMessages', () => {
  beforeEach(() => { localStorage.clear() })

  test('érintetlen napra nincs látott üzenet', () => {
    expect(lastSeenMessage('2026-08-11')).toBeNull()
  })

  test('a megjelölt id visszaolvasható', () => {
    markMessagesSeen('2026-08-11', 'note')
    expect(lastSeenMessage('2026-08-11')).toBe('note')
  })

  test('dátumra kulcsolt — a következő nap újra olvasatlan', () => {
    markMessagesSeen('2026-08-11', 'note')
    expect(lastSeenMessage('2026-08-12')).toBeNull()
  })

  test('sérült/elérhetetlen localStorage nem dob — csendben null', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: private mode')
    })
    expect(() => lastSeenMessage('2026-08-11')).not.toThrow()
    expect(lastSeenMessage('2026-08-11')).toBeNull()
    spy.mockRestore()
  })

  test('elérhetetlen írás sem dob', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => markMessagesSeen('2026-08-11', 'note')).not.toThrow()
    spy.mockRestore()
  })

  test('két user olvasottsága nem keveredik', () => {
    setCurrentUserId('u1')
    markMessagesSeen('2026-08-11', 'note')
    setCurrentUserId('u2')
    expect(lastSeenMessage('2026-08-11')).toBeNull()
    expect(localStorage.getItem('mezo.u1.msgseen.2026-08-11')).toBe('note')
  })
})
