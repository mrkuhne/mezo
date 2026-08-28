import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import type { ChatRecalledMemory } from '@/data/types'

/** W3.1b (mezo-b3pp.28): what ambient recall put in front of the model before it answered —
 *  collapsed by default (the answer is the point; this is its provenance), one line per memory.
 *  Design 2.0 face (mezo-d20.5.2): the expanded rows carry the prototype's lavender memory
 *  hairline (`.memlist li`); copy and disclosure behavior are unchanged. */
export function RecalledMemoriesRow({ items }: { items: ChatRecalledMemory[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="mzc-memwrap col gap-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mzc-membtn row gap-xs"
        title="Ezekre emlékezett a társ a válasz előtt (W3.1 ambient recall)"
        aria-expanded={open}
      >
        <span className="mzc-memeb">Emlékek · {items.length}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={10} color="var(--text-tertiary)" />
      </button>
      {open && (
        <ul className="mzc-memlist col gap-xs">
          {items.map((r, i) => (
            <li key={i} className="col">
              <span className="m1">
                {r.occurredOn} · {r.label} · {Math.round(r.similarity * 100)}%
              </span>
              <span className="m2">{r.gist}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
