// ============================================================
// Mezo · KamraSheetHead — the Kamra sheets' shared head (Üvegesítés U2, mezo-me75u.2)
// The four Kamra sheets (import, kézi tétel, közös katalógus, kategória-szűrő) wear one face on
// the approved prototype (docs/design_2.0/prototypes/uveg-fuel-tobbi.html `SH.import/add/
// catalog/catfilter`): an optional 48px 3D icon, the eyebrow + 21px title, and on the right
// either the round flat × or a sheet-specific action. The sheet itself is the one glass surface
// (`KAMRA_SHEET_CLASS`); everything inside is flat (never glass in glass, bible §3.4).
// ============================================================
import type { ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Icon } from '@/shared/ui/Icon'

/** The Kamra sheets' shell class: a gold glass sheet, no sheen (it scrolls). */
export const KAMRA_SHEET_CLASS = 'fkk-sheet glass is-still'

export function KamraSheetHead({ icon, eyebrow, title, titleId, onClose, action }: {
  icon?: Icon3DName
  eyebrow: string
  title: string
  titleId: string
  /** Renders the round × close; omit when `action` takes the right slot. */
  onClose?: () => void
  action?: ReactNode
}) {
  return (
    <div className="fkk-sh-head">
      {icon && <span className="fkk-sh-art" aria-hidden="true"><Icon3D name={icon} size={48} /></span>}
      <span className="fkk-sh-copy">
        <span className="uv-eyebrow fkk-sh-eb">{eyebrow}</span>
        <h3 id={titleId}>{title}</h3>
      </span>
      {action}
      {onClose && (
        <button type="button" className="fkk-sh-x" aria-label="Bezárás" onClick={onClose}>
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  )
}
