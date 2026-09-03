import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@/data/hooks'
import { AuthShell, ErrorLine, fieldStyle } from '@/features/auth/components/AuthShell'
import { authErrorText } from '@/features/auth/logic/authErrorText'

export function LoginPage({ notice, onSuccess, onRegister }: { notice?: string; onSuccess: () => void | Promise<void>; onRegister: () => void }) {
  const { login } = useAuthActions()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(undefined)
    try { await login({ email: email.trim(), password }); await onSuccess() }
    catch (err) { setError(authErrorText(err)) }
    finally { setBusy(false) }
  }

  return (
    <AuthShell title="Bejelentkezés" footer={<button type="button" onClick={onRegister} style={{ textDecoration: 'underline' }}>Van meghívó kódod?</button>}>
      <form className="col gap-md" onSubmit={submit}>
        {notice && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #6E6257)', textAlign: 'center' }}>{notice}</p>}
        <label className="col gap-xs">E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} />
        </label>
        <label className="col gap-xs">Jelszó
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={fieldStyle} />
        </label>
        <ErrorLine text={error} />
        <button type="submit" className="cta-primary" disabled={busy} style={{ padding: '12px 0' }}>Belépés</button>
      </form>
    </AuthShell>
  )
}
