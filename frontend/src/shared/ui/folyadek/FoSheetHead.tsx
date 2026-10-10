import type { ReactNode } from 'react'
import type { Icon3DName } from '@/shared/ui/clay'
import { Bub } from './Bub'

/** The head of a light sheet (`<Sheet className="fo-sheet">`): optional back, icon bubble, title + sub, the round ×. */
export function FoSheetHead(p: { title: ReactNode; titleId?: string; sub?: ReactNode; icon?: Icon3DName; onBack?: () => void; backLabel?: string; onClose?: () => void }) {
  return (
    <div className="fo-shh">
      {p.onBack && <button type="button" className="fo-ib fo-back" aria-label={p.backLabel ?? 'Vissza'} onClick={p.onBack}>‹</button>}
      {p.icon && <Bub icon={p.icon} size={44} />}
      <div className="g">
        <h2 id={p.titleId}>{p.title}</h2>
        {p.sub != null && <p>{p.sub}</p>}
      </div>
      {p.onClose && <button type="button" className="fo-ib fo-x" aria-label="Bezárás" onClick={p.onClose}>×</button>}
    </div>
  )
}
