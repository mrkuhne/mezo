import { useId, type ReactNode } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import type { Icon3DName } from '@/shared/ui/clay'
import { FoSheetHead } from './FoSheetHead'

/** The short explaining sheet behind a „Mit mutat a sáv?" link or an ⓘ: eyebrow, the info bubble, a title, plain text
 *  (and anything else as children, e.g. a Level). */
export function InfoSheet(p: { title: ReactNode; eyebrow?: ReactNode; copy?: ReactNode; icon?: Icon3DName; onClose: () => void; children?: ReactNode }) {
  const id = `fo-info-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <Sheet onClose={p.onClose} labelledBy={id} className="fo-sheet fo-info-sheet">
      {(close) => (
        <>
          <FoSheetHead titleId={id} eyebrow={p.eyebrow} icon={p.icon ?? 't-info'} title={p.title} onClose={close} />
          {p.copy != null && <p className="fo-txt">{p.copy}</p>}
          {p.children}
        </>
      )}
    </Sheet>
  )
}
