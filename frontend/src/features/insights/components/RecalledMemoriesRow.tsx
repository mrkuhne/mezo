import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import type { ChatRecalledMemory } from '@/data/types'

/** W3.1b (mezo-b3pp.28): what ambient recall put in front of the model before it answered —
 *  collapsed by default (the answer is the point; this is its provenance), one line per memory. */
export function RecalledMemoriesRow({ items }: { items: ChatRecalledMemory[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="col gap-xs" style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="row gap-xs"
        style={{ alignItems: 'center', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
        title="Ezekre emlékezett a társ a válasz előtt (W3.1 ambient recall)"
        aria-expanded={open}
      >
        <span className="eyebrow text-tertiary" style={{ fontSize: 9 }}>Emlékek · {items.length}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={10} color="var(--text-tertiary)" />
      </button>
      {open && (
        <ul className="col gap-xs" style={{ listStyle: 'none', margin: 0, padding: '0 0 0 2px' }}>
          {items.map((r, i) => (
            <li key={i} className="col" style={{ fontSize: 11 }}>
              <span className="text-tertiary" style={{ fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>
                {r.occurredOn} · {r.label} · {Math.round(r.similarity * 100)}%
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{r.gist}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
