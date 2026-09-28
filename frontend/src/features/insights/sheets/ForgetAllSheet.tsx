import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import type { MemoryItem } from '@/data/insights/turnMemoryApi'

const TITLE_ID = 'forget-all-title'

/** Prototype copy for 1 and 2 items (docs/design_2.0/prototypes/elo/mezo.html SH.s8all); the
 *  3+ form is this plan's extension (the prototype never shows more than two). */
export const forgetAllTitle = (n: number) =>
  n === 1 ? 'Ezt az egyet is elfelejtem' : n === 2 ? 'Ezt a kettőt is elfelejtem' : `Ezt a ${n} dolgot is elfelejtem`
export const forgetAllCta = (n: number) =>
  n === 1 ? 'Elfelejtem' : n === 2 ? 'Elfelejtem mind a kettőt' : 'Elfelejtem mindet'
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })

/** S8 (mezo-d6ivw.12): "Mindent ebből a beszélgetésből?" — the confirm step of the widened
 *  forget. Rose glass sheet, flat list, the permanence footnote; the sheet closes only on success. */
export function ForgetAllSheet({ items, onConfirm, onClose }: {
  items: MemoryItem[]
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  return (
    <Sheet glass onClose={onClose} labelledBy={TITLE_ID} className="mzc-memsheet">
      {(close) => (
        <div style={{ ['--c' as string]: 'var(--dv-rose)' }}>
          <SheetHead icon="t-eraser" eyebrow="MINDENT EBBŐL A BESZÉLGETÉSBŐL" title={forgetAllTitle(items.length)}
            titleId={TITLE_ID} onClose={close} />
          <ul className="mzc-memlist">
            {items.map((i) => (
              <li key={`${i.kind}-${i.refId}`}>
                {i.who && <><b>{i.who}</b> — </>}{i.text}
                <small>{i.pending ? 'javaslat, még nem döntöttél róla' : `${hhmm(i.createdAt)}-kor jegyeztem meg`}</small>
              </li>
            ))}
          </ul>
          <p className="mzc-memfoot">
            Végleges: nem használom többé, és ugyanebből nem tanulom meg újra. Amit máskor, máshol mondasz, azt
            továbbra is megjegyezhetem.
          </p>
          {error && <p className="mzc-memerr" role="alert">Nem sikerült elfelejteni — próbáld újra.</p>}
          <div className="mzc-memrow">
            <button type="button" className="mzc-mbtn" style={{ ['--c' as string]: 'var(--dv-rose)' }} disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError(false)
                try {
                  await onConfirm()
                  close()
                } catch {
                  setError(true)
                } finally {
                  setBusy(false)
                }
              }}>
              {forgetAllCta(items.length)}
            </button>
            <button type="button" className="mzc-mbtn is-ghost" onClick={close}>Mégse</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
