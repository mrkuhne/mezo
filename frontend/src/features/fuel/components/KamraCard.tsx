import type { PantryItem } from '@/data/types'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { NovaDot } from '@/features/fuel/components/NovaDot'
import { SHOW_PANTRY_STOCK } from '@/lib/flags'

// Direction A (kamra-mockup-v3-A): the design-system .meal-card anatomy applied to a pantry item —
// a 44px stock slot, Antonio name + source/brand meta, a macro line (food) or protocol (supp), and a
// right-aligned kcal/dose. Notched-chamfer (notch-12) card; supplement/stim get a left inset tint.
const KIND_TINT: Record<string, string> = {
  food: 'var(--brand-glow)',
  supplement: 'var(--info)',
  stim: 'var(--cat-tendency)',
  med: 'var(--error)',
}

export function KamraCard({ item, onOpen }: { item: PantryItem; onOpen: (i: PantryItem) => void }) {
  const tint = KIND_TINT[item.kind] ?? 'var(--brand-glow)'
  const isSupp = item.kind !== 'food'

  const stock = item.stock
  const stockQty = stock && typeof stock.qty === 'number' ? stock.qty : null
  const stockUnit = stock?.unit
  const stockExpires = stock && 'expires' in stock ? stock.expires : undefined
  const stockLowExpiry = stock && 'lowExpiry' in stock ? stock.lowExpiry : undefined
  const lowStock = !!stock && ((stockQty !== null && stockQty < 15) || !!stockLowExpiry)

  return (
    <button
      onClick={() => onOpen(item)}
      className="notch-12 row"
      style={{
        padding: 16,
        textAlign: 'left',
        width: '100%',
        gap: 14,
        alignItems: 'center',
        background: 'var(--surface-1)',
        boxShadow: isSupp ? `inset 2px 0 0 0 color-mix(in srgb, ${tint} 60%, transparent)` : undefined,
      }}
    >
      {/* 44px stock slot (hidden — stock tracking deferred, mezo-6nu) */}
      {SHOW_PANTRY_STOCK && (
        <div style={{ width: 44, flexShrink: 0, textAlign: 'center' }}>
          {stockQty !== null ? (
            <>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 600, lineHeight: 1.1, color: lowStock ? 'var(--warning)' : tint }}>{stockQty}</span>
              <span style={{ display: 'block', fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'var(--text-tertiary)', marginTop: 2 }}>{stockUnit}</span>
            </>
          ) : (
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'var(--text-quaternary)' }}>—</span>
          )}
        </div>
      )}

      {/* Info */}
      <div className="col flex-1" style={{ minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
        <div className="row gap-xs" style={{ alignItems: 'center', marginTop: 7 }}>
          <SourceBadge source={item.source} />
          {item.brand && <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>{item.brand}</span>}
          {item.caffeine && <span className="chip" style={{ fontSize: 8, padding: '1px 5px', color: 'var(--warning)', borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)' }}>koffein</span>}
        </div>

        {item.macros ? (
          <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 9, fontFamily: 'var(--ff-mono)', fontSize: 9 }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>P {item.macros.p}</span>
            <span className="text-tertiary">C {item.macros.c}</span>
            <span className="text-tertiary">F {item.macros.f}</span>
            {item.nova && <NovaDot nova={item.nova} />}
            {SHOW_PANTRY_STOCK && stockExpires && <span style={{ color: stockLowExpiry ? 'var(--error)' : 'var(--text-quaternary)' }}>· {stockLowExpiry ? '⚠ ' : ''}lejár {stockExpires}</span>}
          </div>
        ) : (
          item.protocol && <p className="text-tertiary" style={{ marginTop: 9, fontSize: 10, lineHeight: 1.4, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.protocol}</p>
        )}
      </div>

      {/* Right metric: kcal (food) / dose (supp) */}
      <div className="col" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
        {item.macros ? (
          <>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{item.macros.kcal}</span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'var(--text-tertiary)' }}>kcal</span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 15, fontWeight: 600, color: tint }}>{item.dose}</span>
            {SHOW_PANTRY_STOCK && lowStock && <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'var(--warning)' }}>⚠ fogy</span>}
          </>
        )}
      </div>
    </button>
  )
}
