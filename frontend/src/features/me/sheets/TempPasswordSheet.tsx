import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'

// Shows a freshly minted temporary password ONCE (mezo-qw37.3) — the server stores only the
// hash, so closing this sheet is the last time anyone sees it. The owner reads it out to the
// user, who must change it at next login (must_change_password → S1's ChangePasswordPage).
// Üveg (U10, mezo-me75u.10, `uveg-reteg` `SH.tmp`): a gold glass sheet, the password in one flat
// mono cell, the lit gold „Megjegyeztem" pill.
export function TempPasswordSheet({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  return (
    <Sheet glass onClose={onClose} labelledBy="temp-pw-title" className="uvl-fiok">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-key" eyebrow="Admin · fiókok" title="Ideiglenes jelszó" titleId="temp-pw-title" />
          <p className="uvl-lead">{name} ezzel lép be legközelebb, és rögtön újat kell választania.</p>
          <div className="uvl-code">{password}</div>
          <p className="uvl-hint">Csak most látszik — a szerver csak a hash-t tárolja.</p>
          <button type="button" className="uvl-cta is-wide" onClick={close}>Megjegyeztem</button>
        </div>
      )}
    </Sheet>
  )
}
