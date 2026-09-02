import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { memoryIcon } from '@/features/insights/logic/toolDomains'
import type { ChatRecalledMemory } from '@/data/types'

/** W3.1b (mezo-b3pp.28): what ambient recall put in front of the model before it answered —
 *  collapsed by default (the answer is the point; this is its provenance). mezo-vdf4 face:
 *  the expanded rows became a horizontally scrollable lavender card strip (type icon + date
 *  + similarity ring + clamped gist; a tapped card widens and unclamps). Copy and disclosure
 *  behavior are unchanged. */
export function RecalledMemoriesRow({ items }: { items: ChatRecalledMemory[] }) {
  const [open, setOpen] = useState(false)
  const [openCard, setOpenCard] = useState<number | null>(null)
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
        <span className="mzc-memeb">
          <Icon name="sparkle" size={10} /> Emlékek · {items.length}
        </span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={10} color="var(--text-tertiary)" />
      </button>
      {open && (
        <div className="mzc-memcards">
          {items.map((r, i) => (
            <button
              key={i}
              type="button"
              className={openCard === i ? 'mzc-memcard open' : 'mzc-memcard'}
              onClick={() => setOpenCard(openCard === i ? null : i)}
            >
              <span className="mzc-memtop">
                <span className="mzc-memic"><ClayIcon name={memoryIcon(r.kind)} size={13} /></span>
                <span className="mzc-memkt">
                  <span className="mzc-memkind">{r.label}</span>
                  <span className="mzc-memd">{r.occurredOn}</span>
                </span>
                <span
                  className="mzc-simr"
                  style={{ ['--v' as string]: Math.round(r.similarity * 100) }}
                >
                  <span className="mzc-simr-n">{Math.round(r.similarity * 100)}</span>
                </span>
              </span>
              <span className="mzc-memgist">{r.gist}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
