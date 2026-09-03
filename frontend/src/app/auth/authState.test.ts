import { ApiError } from '@/data/_client/api'
import { deriveFromError, deriveFromMe } from '@/app/auth/authState'

const me = { id: '1', email: 'a@b.c', name: 'A', role: 'USER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest' }

test('an onboarded user with a fresh password is ready', () => {
  expect(deriveFromMe(me)).toBe('ready')
})

test('must-change-password wins over everything', () => {
  expect(deriveFromMe({ ...me, mustChangePassword: true, onboarded: false })).toBe('mustChangePassword')
})

test('a 401/403 on me means the session is dead', () => {
  expect(deriveFromError(new ApiError([{ code: 'AUTH_TOKEN_MISSING', message: '' }], 401))).toBe('signedOut')
  expect(deriveFromError(new ApiError([{ code: 'AUTH_ACCOUNT_DISABLED', message: '' }], 403))).toBe('signedOut')
})

test('a network error or 5xx is a degraded boot, not a logout', () => {
  expect(deriveFromError(new TypeError('Failed to fetch'))).toBe('failed')
  expect(deriveFromError(new ApiError([{ code: 'INTERNAL_ERROR', message: '' }], 503))).toBe('failed')
})
