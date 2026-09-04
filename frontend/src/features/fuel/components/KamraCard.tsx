import type { PantryItem } from '@/data/types'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { NovaDot } from '@/features/fuel/components/NovaDot'

// Kamra v2 (mezo-d20.4.5) — the kind-washed rail card: prototype fuel-body
// #page-kamra .kitem, ported onto the SAME --mz-wash-*/--mz-cell-* tokens
// every other Mozaik tile draws from. `.km-k-{kind}` (styles/prototype.css)
// picks food=sage / supplement=sky / stim=gold(amber) / med=lav — never a
// fifth color, never red. A monogram disc (first letter) stands in for a
// product photo; food rows carry brand + NOVA dot with a tinted kcal/100g
// cell, supp/stim/med rows carry an italic protocol line with a tinted
// dose cell. Stock (SHOW_PANTRY_STOCK) stays deferred — mezo-6nu — this
// card never had a slot for it even in Direction A.
export function KamraCard({ item, onOpen }: { item: PantryItem; onOpen: (i: PantryItem) => void }) {
  const isFood = item.kind === 'food'

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`km-item km-k-${item.kind}`}
      aria-label={item.name}
    >
      <span className="km-thumb" aria-hidden="true">{item.name.charAt(0).toUpperCase()}</span>

      <div className="col flex-1" style={{ minWidth: 0 }}>
        <span className="nm" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.name}
        </span>
        <div className="sb">
          <SourceBadge source={item.source} />
          {isFood ? (
            <>
              {item.brand && <span>{item.brand}</span>}
              {item.nova != null && <NovaDot nova={item.nova} />}
            </>
          ) : (
            <>
              {item.brand && <span>{item.brand}</span>}
              {item.protocol && <span className="proto">{item.protocol}</span>}
            </>
          )}
          {item.caffeine && (
            <span className="chip" style={{ fontSize: 8, padding: '1px 5px', color: 'var(--warning)', borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)' }}>
              koffein
            </span>
          )}
          {item.sharedFrom && (
            <span className="chip" style={{ fontSize: 8, padding: '1px 5px', color: 'var(--mz-cell-sage-ink)', background: 'var(--mz-cell-sage-bg)' }}>
              közös
            </span>
          )}
        </div>
      </div>

      {isFood ? (
        <div className="km-cell">
          <b>{item.macros?.kcal}</b>
          <small>kcal · 100 g</small>
        </div>
      ) : (
        <div className="km-cell">
          <b>{item.dose ?? '—'}</b>
          <small>dózis</small>
        </div>
      )}
    </button>
  )
}
