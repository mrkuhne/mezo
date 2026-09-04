import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'

/** Voluntary password change from Beállítások → Fiók (S2, mezo-qw37.2). The BiometricSheet
 *  header idiom (eyebrow + h-display title + X chip); success closes with the sheet's own motion. */
export function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="change-password-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Fiók</span>
              <div id="change-password-title" className="h-display size-md" style={{ marginTop: 4 }}>Új jelszó</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>
          <ChangePasswordForm onSuccess={close} />
        </div>
      )}
    </Sheet>
  )
}
