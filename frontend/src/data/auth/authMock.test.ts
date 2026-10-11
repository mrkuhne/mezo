import { describe, expect, it } from 'vitest'
import { LANG_KEY } from '@/shared/i18n'
import { mockMe } from '@/data/auth/authMock'

describe('mockMe.language', () => {
  it('is Hungarian on a fresh session, whatever the device language is', () => {
    expect(mockMe.language).toBe('hu')
  })
  it('follows the device cache', () => {
    localStorage.setItem(LANG_KEY, 'en')
    expect(mockMe.language).toBe('en')
    localStorage.setItem(LANG_KEY, 'hu')
    expect(mockMe.language).toBe('hu')
  })
  it('ignores an unsupported cached value', () => {
    localStorage.setItem(LANG_KEY, 'de')
    expect(mockMe.language).toBe('hu')
  })
})
