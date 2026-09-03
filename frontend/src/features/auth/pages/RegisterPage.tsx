import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@/data/hooks'
import { AuthShell, ErrorLine, fieldStyle } from '@/features/auth/components/AuthShell'
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
    <AuthShell title="Regisztráció" footer={<button type="button" onClick={onBack} style={{ textDecoration: 'underline' }}>Vissza a belépéshez</button>}>
      <form className="col gap-md" onSubmit={submit}>
        <label className="col gap-xs">Meghívó kód
          <input autoComplete="off" autoCapitalize="characters" required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="MEZO-XXXX-XXXX" style={{ ...fieldStyle, fontFamily: 'monospace', letterSpacing: 1 }} />
        </label>
        <label className="col gap-xs">Név
          <input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
        </label>
        <label className="col gap-xs">E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} />
        </label>
        <label className="col gap-xs">Jelszó (min. 8 karakter)
          <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={fieldStyle} />
        </label>
        <ErrorLine text={error} />
        <button type="submit" className="cta-primary" disabled={busy} style={{ padding: '12px 0' }}>Fiók létrehozása</button>
      </form>
    </AuthShell>
  )
}
