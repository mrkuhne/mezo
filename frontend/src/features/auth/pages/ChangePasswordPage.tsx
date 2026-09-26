import { useAuthActions } from '@/data/hooks'
import { AuthShell } from '@/features/auth/components/AuthShell'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'

/** Forced (must_change_password after an admin reset) or voluntary full-page variant; the
 *  Beállítások entry is ChangePasswordSheet (S2), which shares ChangePasswordForm. */
export function ChangePasswordPage({ forced = false, onSuccess, onCancel }: { forced?: boolean; onSuccess: () => void | Promise<void>; onCancel?: () => void }) {
  const { logout } = useAuthActions()
  const footer = forced
    ? <button type="button" className="auth-link" onClick={logout}>Kijelentkezés</button>
    : onCancel && <button type="button" className="auth-link" onClick={onCancel}>Mégse</button>

  return (
    <AuthShell title="Új jelszó" footer={footer}
      lead={forced ? 'Ideiglenes jelszóval léptél be — válassz egy sajátot.' : undefined}>
      <ChangePasswordForm glass gold={forced} onSuccess={onSuccess} />
    </AuthShell>
  )
}
