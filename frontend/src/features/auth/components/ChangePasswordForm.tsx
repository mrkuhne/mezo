import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@/data/hooks'
import { ErrorLine, fieldStyle } from '@/features/auth/components/AuthShell'
import { authErrorText } from '@/features/auth/logic/authErrorText'

// See RegisterPage.tsx for why this client-side byte check exists: the server's 72-byte
// bcrypt limit can be crossed by an accented password under 72 characters, and the
// server's error code alone can't be told apart from a too-short password's.
const MAX_PASSWORD_BYTES = 72
const passwordByteLength = (s: string) => new TextEncoder().encode(s).length

/** The change-password fields + submit — shared by the forced ChangePasswordPage (AuthGate) and the
 *  voluntary ChangePasswordSheet (Beállítások → Fiók). Client-side checks: min 8, the 72-byte
 *  bcrypt ceiling, confirmation match. */
export function ChangePasswordForm({ onSuccess }: { onSuccess: () => void | Promise<void> }) {
  const { changePassword } = useAuthActions()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 8) { setError('A jelszó legalább 8 karakter legyen.'); return }
    if (passwordByteLength(next) > MAX_PASSWORD_BYTES) {
      setError('A jelszó túl hosszú (max. 72 bájt — az ékezetes betűk többet számítanak).')
      return
    }
    if (next !== again) { setError('A két új jelszó nem egyezik.'); return }
    setBusy(true); setError(undefined)
    try { await changePassword({ currentPassword: current, newPassword: next }); await onSuccess() }
    catch (err) { setError(authErrorText(err)) }
    finally { setBusy(false) }
  }

  return (
    <form className="col gap-md" onSubmit={submit}>
      <label className="col gap-xs">Jelenlegi jelszó
        <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} style={fieldStyle} />
      </label>
      <label className="col gap-xs">Új jelszó (min. 8 karakter)
        <input type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} style={fieldStyle} />
      </label>
      <label className="col gap-xs">Új jelszó még egyszer
        <input type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} style={fieldStyle} />
      </label>
      <ErrorLine text={error} />
      <button type="submit" className="cta-primary" disabled={busy} style={{ padding: '12px 0' }}>Jelszó mentése</button>
    </form>
  )
}
