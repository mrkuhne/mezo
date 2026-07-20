import { Sheet } from '@/shared/ui/Sheet'
import type { Reflection } from '@/data/types'

const OPTS: { v: Reflection; label: string }[] = [
  { v: 'yes', label: 'Igen' }, { v: 'partial', label: 'Részben' }, { v: 'no', label: 'Nem' },
]

export function ReflectSheet({ onReflect, onClose }:
  { onReflect: (v: Reflection) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="reflect-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', gap: 14 }}>
          <h2 id="reflect-title" style={{ font: '700 18px/1.2 var(--ff-display)' }}>Szándékkal élted a napot?</h2>
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
