import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@/data/hooks'
import { AuthField, ErrorLine } from '@/features/auth/components/AuthShell'
import { cn } from '@/shared/lib/cn'
import { authErrorText } from '@/features/auth/logic/authErrorText'

// See RegisterPage.tsx for why this client-side byte check exists: the server's 72-byte
// bcrypt limit can be crossed by an accented password under 72 characters, and the
// server's error code alone can't be told apart from a too-short password's.
const MAX_PASSWORD_BYTES = 72
const passwordByteLength = (s: string) => new TextEncoder().encode(s).length

/** The change-password fields + submit — shared by the forced ChangePasswordPage (AuthGate) and the
 *  voluntary ChangePasswordSheet (Beállítások → Fiók). Client-side checks: min 8, the 72-byte
 *  bcrypt ceiling, confirmation match.
 *  `glass` (mezo-me75u.10): the auth page's üveg card — the form IS one `.auth-card.glass`
 *  (`gold` tints it for the forced change). Without it (the ChangePasswordSheet, itself a
 *  `<Sheet glass>`), the inputs carry NO inline skin so the kit's `.sheet.glass.uv-sheet`
 *  field rules reach them — an inline style would outrank every sheet rule. */
export function ChangePasswordForm({ onSuccess, glass = false, gold = false }: {
  onSuccess: () => void | Promise<void>
  glass?: boolean
  gold?: boolean
}) {
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

  if (glass) {
    return (
      <form className={cn('auth-card glass', gold && 'is-gold')} onSubmit={submit}>
        <AuthField label="Jelenlegi jelszó">
          <input className="auth-inp" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </AuthField>
        <AuthField label="Új jelszó (min. 8 karakter)">
          <input className="auth-inp" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
        </AuthField>
        <AuthField label="Új jelszó még egyszer">
          <input className="auth-inp" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} />
        </AuthField>
        <ErrorLine text={error} />
        <button type="submit" className="auth-cta" disabled={busy}>Jelszó mentése</button>
      </form>
    )
  }

  // The sheet path (Beállítások → Fiók): it sits inside the gold glass `<Sheet glass>`, so the
  // form itself stays flat — eyebrow labels, flat fields, the lit gold pill (`── uveg reteg lap (`).
  return (
    <form className="uvl-form" onSubmit={submit}>
      <label className="uvl-field"><span className="uvl-flabel">Jelenlegi jelszó</span>
        <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="uvl-field"><span className="uvl-flabel">Új jelszó (min. 8 karakter)</span>
        <input type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="uvl-field"><span className="uvl-flabel">Új jelszó még egyszer</span>
        <input type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} />
      </label>
      <ErrorLine text={error} />
      <button type="submit" className="uvl-cta is-wide" disabled={busy}>Jelszó mentése</button>
    </form>
  )
}
