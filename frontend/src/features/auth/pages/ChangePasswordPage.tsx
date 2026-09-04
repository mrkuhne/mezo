import { useAuthActions } from '@/data/hooks'
import { AuthShell } from '@/features/auth/components/AuthShell'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'

/** Forced (must_change_password after an admin reset) or voluntary full-page variant; the
 *  Beállítások entry is ChangePasswordSheet (S2), which shares ChangePasswordForm. */
export function ChangePasswordPage({ forced = false, onSuccess, onCancel }: { forced?: boolean; onSuccess: () => void | Promise<void>; onCancel?: () => void }) {
  const { logout } = useAuthActions()
  const footer = forced
    ? <button type="button" onClick={logout} style={{ textDecoration: 'underline' }}>Kijelentkezés</button>
    : onCancel && <button type="button" onClick={onCancel} style={{ textDecoration: 'underline' }}>Mégse</button>

  return (
    <AuthShell title="Új jelszó" footer={footer}>
      {forced && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #6E6257)', textAlign: 'center' }}>Ideiglenes jelszóval léptél be — válassz egy sajátot.</p>}
      <ChangePasswordForm onSuccess={onSuccess} />
    </AuthShell>
  )
}
