import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@/data/hooks'
import { AuthField, AuthShell, ErrorLine } from '@/features/auth/components/AuthShell'
import { authErrorText } from '@/features/auth/logic/authErrorText'

// Server rejects a password over 72 UTF-8 BYTES (bcrypt's limit), not 72 characters — an
// accented Hungarian password can cross that with fewer than 72 characters. Catching it here
// lets us show a message that's actually right for "too long"; the server-error fallback
// (authErrorText's BY_FIELD map) says "legalább 8 karakter" which is correct for "too short"
// but would be misleading here, and the two cases share the same wire code + fieldName so
// authErrorText alone can't tell them apart. See task-11-report.md for the full rationale.
const MAX_PASSWORD_BYTES = 72
const passwordByteLength = (s: string) => new TextEncoder().encode(s).length

export function RegisterPage({ onSuccess, onBack }: { onSuccess: () => void | Promise<void>; onBack: () => void }) {
  const { register } = useAuthActions()
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('A jelszó legalább 8 karakter legyen.'); return }
    if (passwordByteLength(password) > MAX_PASSWORD_BYTES) {
      setError('A jelszó túl hosszú (max. 72 bájt — az ékezetes betűk többet számítanak).')
      return
    }
    setBusy(true); setError(undefined)
    try { await register({ inviteCode: inviteCode.trim().toUpperCase(), name: name.trim(), email: email.trim(), password }); await onSuccess() }
    catch (err) { setError(authErrorText(err)) }
    finally { setBusy(false) }
  }

  return (
    <AuthShell title="Regisztráció" footer={<button type="button" className="auth-link" onClick={onBack}>Vissza a belépéshez</button>}>
      <form className="auth-card glass" onSubmit={submit}>
        <AuthField label="Meghívó kód">
          <input className="auth-inp is-mono" autoComplete="off" autoCapitalize="characters" required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="MEZO-XXXX-XXXX" />
        </AuthField>
        <AuthField label="Név">
          <input className="auth-inp" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </AuthField>
        <AuthField label="E-mail">
          <input className="auth-inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </AuthField>
        <AuthField label="Jelszó (min. 8 karakter)">
          <input className="auth-inp" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </AuthField>
        <ErrorLine text={error} />
        <button type="submit" className="auth-cta" disabled={busy}>Fiók létrehozása</button>
      </form>
    </AuthShell>
  )
}
