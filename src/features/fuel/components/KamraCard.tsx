import type { PantryItem } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { NovaDot } from '@/components/ui/NovaDot'

export function KamraCard({ item, onOpen }: { item: PantryItem; onOpen: (i: PantryItem) => void }) {
  const { categoryMeta } = usePantry()
  const catColor = categoryMeta[item.category]?.color ?? 'var(--text-secondary)'

  const isStim = item.kind === 'stim'
  const isMed = item.kind === 'med'
  const isCaff = item.caffeine

  const stock = item.stock
  const stockQty = stock && typeof stock.qty === 'number' ? stock.qty : null
  const stockExpires = stock && 'expires' in stock ? stock.expires : undefined
  const stockLowExpiry = stock && 'lowExpiry' in stock ? stock.lowExpiry : undefined

  const lowStock = !!stock && ((stockQty !== null && stockQty < 15) || !!stockLowExpiry)

  return (
    <button
      onClick={() => onOpen(item)}
      className="card notch-8"
      style={{
        padding: 14,
        textAlign: 'left',
        width: '100%',
        borderColor: lowStock ? 'color-mix(in srgb, var(--warning) 25%, transparent)' : 'var(--border-subtle)',
        background: lowStock ? 'color-mix(in srgb, var(--warning) 3%, transparent)' : 'var(--surface-1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: catColor }} />

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingLeft: 6 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
            {isCaff && <span className="chip" style={{ fontSize: 8, padding: '1px 5px', color: 'var(--warning)', borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)' }}>koffein</span>}
            {isStim && !isCaff && <span className="chip" style={{ fontSize: 8, padding: '1px 5px', color: 'var(--cat-tendency)', borderColor: 'color-mix(in srgb, var(--cat-tendency) 40%, transparent)' }}>pörgető</span>}
            {isMed && <span className="chip" style={{ fontSize: 8, padding: '1px 5px', color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 40%, transparent)' }}>gyógyszer</span>}
          </div>
          <div className="row gap-sm mt-xs" style={{ alignItems: 'center' }}>
            <SourceBadge source={item.source} />
            <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>{item.brand}</span>
          </div>
        </div>

        {/* Right-side: macros (food) OR dose (supp) */}
        <div className="col" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          {item.macros ? (
            <>
              <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>kcal / {item.per}{item.unit}</span>
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 17, fontWeight: 600, color: catColor, lineHeight: 1, marginTop: 2 }}>
                {item.macros.kcal}
              </span>
            </>
          ) : (
            <>
              <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>Adag</span>
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, color: catColor, lineHeight: 1, marginTop: 2 }}>{item.dose}</span>
            </>
          )}
        </div>
      </div>

      {/* Macro line (food) */}
      {item.macros && (
        <div className="mt-md" style={{ paddingLeft: 6 }}>
          <div className="row gap-md" style={{ fontFamily: 'var(--ff-mono)', fontSize: 10 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>P <span style={{ color: 'var(--text-primary)' }}>{item.macros.p}g</span></span>
            <span style={{ color: 'var(--text-tertiary)' }}>C <span style={{ color: 'var(--text-primary)' }}>{item.macros.c}g</span></span>
            <span style={{ color: 'var(--text-tertiary)' }}>F <span style={{ color: 'var(--text-primary)' }}>{item.macros.f}g</span></span>
            <span style={{ color: 'var(--text-quaternary)', marginLeft: 4 }}>/ {item.per}{item.unit}</span>
          </div>
        </div>
      )}

      {/* Supplement protocol line */}
      {item.protocol && !item.macros && (
        <p className="text-secondary mt-sm" style={{ fontSize: 11, lineHeight: 1.4, paddingLeft: 6 }}>{item.protocol}</p>
      )}

      {/* Bottom strip: price / stock / expiry */}
      <div className="row mt-md" style={{ justifyContent: 'space-between', alignItems: 'center', paddingLeft: 6, gap: 8 }}>
        <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          {item.price && (
            <span style={{
              fontFamily: 'var(--ff-mono)', fontSize: 10,
              color: 'var(--text-secondary)',
              padding: '1px 5px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
            }}>{item.price} {item.priceUnit}</span>
          )}
          {item.pkg && !item.dose && (
            <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>{item.pkg}</span>
          )}
          {item.nova && <NovaDot nova={item.nova} />}
        </div>
        <div className="row gap-xs" style={{ alignItems: 'center' }}>
          {stockQty !== null && (
            <span className="label-mono" style={{
              fontSize: 9,
              color: lowStock ? 'var(--warning)' : 'var(--text-tertiary)',
            }}>
              {stockQty}{stock?.unit} polcon
            </span>
          )}
          {stockExpires && (
            <span className="label-mono" style={{
              fontSize: 9,
              color: stockLowExpiry ? 'var(--warning)' : 'var(--text-quaternary)',
            }}>· {stockExpires}</span>
          )}
        </div>
      </div>

      {item.usedInRecipes != null && item.usedInRecipes > 0 && (
        <div className="row" style={{ paddingLeft: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', justifyContent: 'space-between' }}>
          <span className="text-tertiary" style={{ fontSize: 9, fontFamily: 'var(--ff-mono)' }}>
            {item.usedInRecipes} receptben · utoljára {item.lastUsed}
          </span>
        </div>
      )}
    </button>
  )
}
