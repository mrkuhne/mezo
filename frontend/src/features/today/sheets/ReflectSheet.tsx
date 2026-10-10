import { Sheet } from '@/shared/ui/Sheet'
import { FoSheetHead, Mini } from '@/shared/ui/folyadek'
import type { Reflection } from '@/data/types'

const OPTS: { v: Reflection; label: string; pct: number }[] = [
  { v: 'yes', label: 'Igen', pct: 100 }, { v: 'partial', label: 'Részben', pct: 50 }, { v: 'no', label: 'Nem', pct: 4 },
]

// The evening answer to the morning focus (the `intention_reflect` row of the routine).
// FOLYADÉK (mezo-n4wf5.2, prototypes/vilagos/nap.js `SHEETS.reflect`, `.np-ref`): a light sheet;
// the three answers are three capsules: full, half, nearly empty. `foci` (optional) are the
// day's own focus sentences, quoted in the sub line.
export function ReflectSheet({ onReflect, onClose, foci }:
  { onReflect: (v: Reflection) => void; onClose: () => void; foci?: string[] }) {
  const quoted = (foci ?? []).map((f) => `„${f}”`).join(', ')
  return (
    <Sheet onClose={onClose} labelledBy="reflect-title" className="fo-sheet nck2-sheet">
      {(close) => (
        <>
          <FoSheetHead titleId="reflect-title" title="Szándékkal élted a napot?" icon="t-ring" onClose={close}
            sub={quoted ? `Rutin · este · a mai szándékod: ${quoted}` : 'Rutin · este'} />
          <div className="nck2-ref">
            {OPTS.map((o) => (
              <button key={o.v} type="button" onClick={() => { onReflect(o.v); close() }}>
                <Mini pct={o.pct} /><b>{o.label}</b>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
