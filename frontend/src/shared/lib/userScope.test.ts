import { afterEach, describe, expect, test } from 'vitest'
import { currentUserId, setCurrentUserId, userScopedKey, userScopedPrefix } from '@/shared/lib/userScope'

afterEach(() => setCurrentUserId(null))

describe('userScope', () => {
  test('kijelentkezve az anon névtérbe kulcsol', () => {
    expect(currentUserId()).toBeNull()
    expect(userScopedKey('msgseen.2026-09-02')).toBe('mezo.anon.msgseen.2026-09-02')
  })
  test('bejelentkezve a user id a névtér', () => {
    setCurrentUserId('11111111-2222-3333-4444-555555555555')
    expect(userScopedKey('night-wake:2026-09-02')).toBe('mezo.11111111-2222-3333-4444-555555555555.night-wake:2026-09-02')
    expect(userScopedPrefix()).toBe('mezo.11111111-2222-3333-4444-555555555555.')
  })
  test('két user kulcsa sosem ütközik', () => {
    setCurrentUserId('a')
    const ka = userScopedKey('sleep-escal-snooze')
    setCurrentUserId('b')
    expect(userScopedKey('sleep-escal-snooze')).not.toBe(ka)
  })
})
