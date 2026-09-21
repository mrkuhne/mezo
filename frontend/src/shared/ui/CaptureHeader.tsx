import { Icon } from '@/shared/ui/Icon'
import { CaptureArt, type CaptureKind } from '@/shared/ui/CaptureArt'

/** Common capture-sheet anatomy; the domain owns its inputs, state and save action. */
export function CaptureHeader({ id, title, subtitle, eyebrow = 'Gyors rögzítés', kind, onClose, onBack }: {
  id: string; title: string; subtitle?: string; eyebrow?: string; kind: CaptureKind
  onClose: () => void; onBack?: () => void
}) {
  return (
    <header className="capture-header">
      <div className="capture-toolbar">
        {onBack ? <button type="button" className="capture-dismiss" onClick={onBack} aria-label="Vissza"><Icon name="chevron-left" size={18} /></button> : <span />}
        <span className="capture-eyebrow">{eyebrow}</span>
        <button type="button" className="capture-dismiss" onClick={onClose} aria-label="Bezárás"><Icon name="x" size={18} /></button>
      </div>
      <div className="capture-heading">
        <CaptureArt kind={kind} />
        <div><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      </div>
    </header>
  )
}
