import type { ReactNode } from 'react'
import type { Icon3DName } from '@/shared/ui/clay'
import { Bub } from './Bub'

/** The head of a light sheet (`<Sheet className="fo-sheet">`): optional back, icon bubble (or `left`: a muscle chip, a badge),
 *  title + sub, the round ×. With `eyebrow` the sheet's context line stands on top with the × beside it. */
export function FoSheetHead(p: { title: ReactNode; titleId?: string; sub?: ReactNode; icon?: Icon3DName; left?: ReactNode; eyebrow?: ReactNode; onBack?: () => void; backLabel?: string; onClose?: () => void }) {
  const x = p.onClose && <button type="button" className="fo-ib fo-x" aria-label="Bezárás" onClick={p.onClose}>×</button>
  const head = (
    <div className={p.eyebrow != null ? 'fo-shh mid' : 'fo-shh'}>
      {p.onBack && <button type="button" className="fo-ib fo-back" aria-label={p.backLabel ?? 'Vissza'} onClick={p.onBack}>‹</button>}
      {p.left ?? (p.icon && <Bub icon={p.icon} size={p.eyebrow != null ? 46 : 44} />)}
      <div className="g">
        <h2 id={p.titleId}>{p.title}</h2>
        {p.sub != null && <p>{p.sub}</p>}
      </div>
      {p.eyebrow == null && x}
    </div>
  )
  if (p.eyebrow == null) return head
  return (
    <>
      <div className="fo-she"><span>{p.eyebrow}</span>{x}</div>
      {head}
    </>
  )
}
