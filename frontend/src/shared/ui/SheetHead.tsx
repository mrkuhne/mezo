import type { ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

/**
 * The glass sheet's head (U10, mezo-me75u.10 — prototype `uveg-reteg` `.shh`): a 44px Titanium
 * 3D icon, the accent-tinted eyebrow over the title, an optional sub-line, an optional action
 * slot and the flat round ×. It pairs with `<Sheet glass>`; the hue comes from the sheet's `--c`.
 * Styles live in `prototype.css` `── uveg reteg lap (`.
 */
export function SheetHead({ icon, eyebrow, title, titleId, onClose, sub, action }: {
  icon: Icon3DName
  eyebrow?: ReactNode
  title: ReactNode
  /** The sheet's `labelledBy` target — the title element carries it. */
  titleId?: string
  /** Renders the flat round × (the sheet's animated close). */
  onClose?: () => void
  /** A quiet line under the title (context, a live counter…). */
  sub?: ReactNode
  /** Extra control before the × (e.g. a „Kész" pill). */
  action?: ReactNode
}) {
  return (
    <div className="uvl-shh">
      <Icon3D name={icon} size={44} />
      <div className="uvl-shh-t">
        {eyebrow != null && <span className="uv-eyebrow uvl-shh-eb">{eyebrow}</span>}
        <h2 id={titleId} className="uvl-shh-h">{title}</h2>
        {sub != null && <span className="uvl-shh-sub">{sub}</span>}
      </div>
      {action}
      {onClose && (
        <button type="button" className="uvl-x" aria-label="Bezárás" onClick={onClose}>✕</button>
      )}
    </div>
  )
}

/** A sheet's error line: coral text with the Titanium „info" mark (never a bare red paragraph). */
export function SheetError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="uvl-err">
      <Icon3D name="t-info" size={18} />
      <span>{children}</span>
    </p>
  )
}
