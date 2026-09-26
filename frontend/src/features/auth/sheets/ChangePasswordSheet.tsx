import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'

/** Voluntary password change from Beállítások → Fiók (S2, mezo-qw37.2); success closes with the
 *  sheet's own motion. Üveg (U10, mezo-me75u.10, `uveg-reteg` `SH.pw`): a gold glass sheet, the
 *  key icon head, flat fields, the lit gold „Jelszó mentése" pill. */
export function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet glass onClose={onClose} labelledBy="change-password-title" className="uvl-fiok uvl-pw">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-key" eyebrow="Fiók" title="Új jelszó" titleId="change-password-title" onClose={close} />
          <ChangePasswordForm onSuccess={close} />
        </div>
      )}
    </Sheet>
  )
}
