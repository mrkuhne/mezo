import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@/data/hooks'
import { AuthField, AuthNotice, AuthShell, ErrorLine } from '@/features/auth/components/AuthShell'
import type { Icon3DName } from '@/shared/ui/clay'
import { authErrorText } from '@/features/auth/logic/authErrorText'

export function LoginPage({ notice, noticeIcon, onSuccess, onRegister }: {
  notice?: string
  /** The notice cell's 3D icon: `t-clock` for an expired session, `t-info` otherwise. */
  noticeIcon?: Icon3DName
  onSuccess: () => void | Promise<void>
  onRegister: () => void
}) {
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
    <AuthShell title="Bejelentkezés" footer={<button type="button" className="auth-link" onClick={onRegister}>Van meghívó kódod?</button>}>
      {notice && <AuthNotice icon={noticeIcon}>{notice}</AuthNotice>}
      <form className="auth-card glass" onSubmit={submit}>
        <AuthField label="E-mail">
          <input className="auth-inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </AuthField>
        <AuthField label="Jelszó">
          <input className="auth-inp" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </AuthField>
        <ErrorLine text={error} />
        <button type="submit" className="auth-cta" disabled={busy}>Belépés</button>
      </form>
    </AuthShell>
  )
}
