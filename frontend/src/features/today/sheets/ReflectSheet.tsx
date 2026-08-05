import { Sheet } from '@/shared/ui/Sheet'
import type { Reflection } from '@/data/types'

const OPTS: { v: Reflection; label: string }[] = [
  { v: 'yes', label: 'Igen' }, { v: 'partial', label: 'Részben' }, { v: 'no', label: 'Nem' },
]

// DS re-dress (mezo-setx.5.5): h2 role title; the option row reuses the DS-restyled
// .reflect-opt buttons (44px min targets, press feedback).
export function ReflectSheet({ onReflect, onClose }:
  { onReflect: (v: Reflection) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="reflect-title">
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
