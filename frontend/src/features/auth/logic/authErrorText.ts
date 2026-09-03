import { ApiError } from '@/data/_client/api'

const BY_CODE: Record<string, string> = {
  AUTH_LOGIN_INVALID_CREDENTIALS: 'Hibás e-mail vagy jelszó.',
  AUTH_ACCOUNT_DISABLED: 'Ezt a fiókot letiltották.',
  AUTH_INVITE_INVALID: 'Ez a meghívó kód nem érvényes.',
  AUTH_EMAIL_TAKEN: 'Ezzel az e-mail címmel már van fiók.',
}

const BY_FIELD: Record<string, string> = {
  password: 'A jelszó legalább 8 karakter legyen.',
  newPassword: 'A jelszó legalább 8 karakter legyen.',
  email: 'Adj meg egy érvényes e-mail címet.',
  inviteCode: 'Add meg a meghívó kódot.',
  name: 'Add meg a neved.',
}

/** Server error → one Hungarian line for the auth forms. Codes are the contract, not message text. */
export function authErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    for (const m of err.messages) {
      if (m.fieldName && BY_FIELD[m.fieldName]) return BY_FIELD[m.fieldName]
      if (BY_CODE[m.code]) return BY_CODE[m.code]
    }
  }
  return 'Nem sikerült kapcsolódni. Próbáld újra.'
}
