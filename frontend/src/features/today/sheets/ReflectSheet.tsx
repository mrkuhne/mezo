import { Sheet } from '@/shared/ui/Sheet'
import type { Reflection } from '@/data/types'

const OPTS: { v: Reflection; label: string }[] = [
  { v: 'yes', label: 'Igen' }, { v: 'partial', label: 'Részben' }, { v: 'no', label: 'Nem' },
]

// DS re-dress (mezo-setx.5.5): h2 role title; the option row reuses the DS-restyled
// .reflect-opt buttons (44px min targets, press feedback).
// Üveg (mezo-me75u.3): ONE floating amber glass sheet (bible U2 rule 15); the three options are
// lit flat pills inside it. Styling only — `nap-glass-sheet` in the `uveg nap oldalak` block.
export function ReflectSheet({ onReflect, onClose }:
  { onReflect: (v: Reflection) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="reflect-title" className="glass nap-glass-sheet">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', gap: 14 }}>
          <h2 id="reflect-title" className="h-display size-lg">Szándékkal élted a napot?</h2>
          <div className="reflect-opts">
            {OPTS.map((o) => (
              <button key={o.v} className="reflect-opt" onClick={() => { onReflect(o.v); close() }}>{o.label}</button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
