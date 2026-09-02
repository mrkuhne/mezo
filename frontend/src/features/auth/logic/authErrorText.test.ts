import { ApiError } from '@/data/_client/api'
import { authErrorText } from '@/features/auth/logic/authErrorText'

const api = (code: string, status: number) => new ApiError([{ code, message: 'server text' }], status)

test('maps the auth codes to Hungarian copy', () => {
  expect(authErrorText(api('AUTH_LOGIN_INVALID_CREDENTIALS', 401))).toBe('Hibás e-mail vagy jelszó.')
  expect(authErrorText(api('AUTH_ACCOUNT_DISABLED', 403))).toBe('Ezt a fiókot letiltották.')
  expect(authErrorText(api('AUTH_INVITE_INVALID', 409))).toBe('Ez a meghívó kód nem érvényes.')
  expect(authErrorText(api('AUTH_EMAIL_TAKEN', 409))).toBe('Ezzel az e-mail címmel már van fiók.')
})

test('field validation names the field', () => {
  const err = new ApiError([{ code: 'VALIDATION_INVALID_VALUE', message: 'x', fieldName: 'password' }], 400)
  expect(authErrorText(err)).toBe('A jelszó legalább 8 karakter legyen.')
})

test('anything else is a generic retry line', () => {
  expect(authErrorText(new TypeError('Failed to fetch'))).toBe('Nem sikerült kapcsolódni. Próbáld újra.')
})
