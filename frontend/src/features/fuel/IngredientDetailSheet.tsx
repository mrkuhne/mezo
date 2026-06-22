// ============================================================
// Mezo · IngredientDetailSheet
// Kamra item detail bottom sheet. Top→bottom:
//   header (source + name + brand + ×) → macro hero OR protocol
//   card → micros density bars → stock + price card →
//   used-in-recipes list → inert action buttons → scrape footer.
// Ports prototype fuel-kamra.jsx:338-477 faithfully.
// ============================================================
import { useState } from 'react'
import type { IngredientStock, PantryItem, PantryItemInput } from '@/data/types'
import { usePantry, usePantryActions, useRecipes } from '@/data/hooks'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { StatCell } from '@/components/ui/StatCell'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { AddPantryItemSheet } from '@/features/fuel/AddPantryItemSheet'

// The full IngredientStock carries expires/lowExpiry; the bare { qty, unit }
// stock shape does not. Narrow once instead of fighting `in`-narrowing in JSX.
function isFullStock(s: NonNullable<PantryItem['stock']>): s is IngredientStock {
  return 'expires' in s
}

// Build a PantryItemInput from the displayed item — used both to prefill the
// edit sheet and as the base for the quick stock "Frissítés" update so other
// fields are preserved through the mutation.
function inputFromItem(item: PantryItem): PantryItemInput {
  const base: PantryItemInput = {
    kind: item.kind,
    name: item.name,
    brand: item.brand,
    source: item.source,
    category: item.category,
    per: item.per,
    unit: item.unit,
    stockQty: item.stock?.qty,
    stockUnit: item.stock?.unit,
  }
  if (item.macros) {
    base.kcal = item.macros.kcal
    base.proteinG = item.macros.p
    base.carbsG = item.macros.c
    base.fatG = item.macros.f
  }
  if (item.dose) base.dose = item.dose
  if (item.form) base.form = item.form
  if (item.protocol) base.protocol = item.protocol
  return base
}

export function IngredientDetailSheet({ item, onClose }: { item: PantryItem; onClose: () => void }) {
  const { categoryMeta } = usePantry()
  const { recipes } = useRecipes()
  const { updateItem, deleteItem } = usePantryActions()
  const [editOpen, setEditOpen] = useState(false)
  const catColor = categoryMeta[item.category]?.color ?? 'var(--text-secondary)'
  const usingRecipes = recipes.filter(r => r.ingredients.some(ri => ri.refId === item.id))

  // stock may be the full IngredientStock (with expires/lowExpiry) or the bare
  // { qty, unit } shape — qty/unit exist on both; expires/lowExpiry only on the
  // full shape, so read them defensively.
  const stock = item.stock ?? null
  const stockQty: number | undefined = stock?.qty
  const stockUnit: string | undefined = stock?.unit
  const hasStock = stock != null && typeof stockQty === 'number'
  const stockExpires = stock && isFullStock(stock) ? stock.expires : undefined
  const stockLowExpiry = stock && isFullStock(stock) ? stock.lowExpiry : undefined

  // buildKamraItems prefixes stash (supplement/stim/med) card ids with 'stash-'
  // to keep them collision-free against food ingredient ids in the card list.
  // Mutations must target the BACKEND id — the raw mock id / real UUID — so strip
  // the prefix once here and use it for every action (edit/update/delete). Food
  // cards carry the raw ingredient id, so this is a no-op for them.
  const backendId = item.id.startsWith('stash-') ? item.id.slice('stash-'.length) : item.id

  // Quick stock bump: re-persist the item with one more unit on the shelf.
  const bumpStock = () => {
    const base = inputFromItem(item)
    updateItem(backendId, { ...base, stockQty: (base.stockQty ?? 0) + 1 })
  }
  const remove = () => {
    deleteItem(backendId)
    onClose()
  }

  return (
    <>
    <Sheet onClose={onClose} labelledBy="ingredient-detail-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <div className="row gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                <SourceBadge source={item.source} size="lg" />
                <span className="text-tertiary" style={{ fontSize: 11, fontFamily: 'var(--ff-mono)' }}>{item.brand}</span>
              </div>
              <div id="ingredient-detail-title" style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                {item.name}
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Macro hero */}
          {item.macros && (
            <div className="card notch-4 row" style={{ padding: 12, justifyContent: 'space-between', marginBottom: 14 }}>
              <StatCell label={'kcal / ' + (item.per ?? '') + (item.unit ?? '')} val={String(item.macros.kcal)} sub="" color={catColor} />
              <StatCell label="Protein" val={item.macros.p + 'g'} sub="" color="var(--cat-physiology)" />
              <StatCell label="Carb" val={item.macros.c + 'g'} sub="" color="var(--warning)" />
              <StatCell label="Fat" val={item.macros.f + 'g'} sub="" color="var(--cat-preference)" />
            </div>
          )}

          {/* Supplement protocol */}
          {item.protocol && !item.macros && (
            <div className="card notch-4" style={{ padding: 12, marginBottom: 14 }}>
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>PROTOKOLL</span>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 6, lineHeight: 1.5 }}>{item.protocol}</p>
              <div className="row gap-md mt-md" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                <div className="col flex-1">
                  <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>ADAG</span>
                  <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, color: catColor, marginTop: 2 }}>{item.dose}</span>
                </div>
                <div className="col flex-1">
                  <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>FORMA</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{item.form}</span>
                </div>
              </div>
            </div>
          )}

          {/* Micros */}
          {item.micros && item.micros.length > 0 && (
            <div className="card notch-4" style={{ padding: 12, marginBottom: 14 }}>
              <Eyebrow>Mikrotápanyag-density</Eyebrow>
              <div className="col gap-sm mt-sm">
                {item.micros.map((m, i) => (
                  <div key={i} className="row gap-md" style={{ alignItems: 'center' }}>
                    <span className="label-mono" style={{ width: 90, fontSize: 10 }}>{m.name}</span>
                    <ProgressBar className="flex-1" value={Math.min(100, m.pct)} color="var(--brand-glow)" glow />
                    <span className="label-mono text-tertiary" style={{ fontSize: 9, width: 28, textAlign: 'right' }}>{m.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock + price */}
          <div className="card notch-4" style={{ padding: 12, marginBottom: 14 }}>
            <div className="row gap-md" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="col flex-1">
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>ÁR · {item.source}</span>
                <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, color: 'var(--text-primary)', marginTop: 4 }}>
                  {item.price || '—'} <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{item.priceUnit}</span>
                </span>
                {item.pkg && <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)', marginTop: 4 }}>{item.pkg}</span>}
              </div>
              {hasStock && (
                <div className="col flex-1" style={{ alignItems: 'flex-end' }}>
                  <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>POLCON</span>
                  <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, color: stockLowExpiry ? 'var(--warning)' : 'var(--brand-glow)', marginTop: 4 }}>
                    {stockQty} {stockUnit}
                  </span>
                  {stockExpires && (
                    <span className="label-mono" style={{ fontSize: 9, color: stockLowExpiry ? 'var(--warning)' : 'var(--text-tertiary)', marginTop: 2 }}>
                      lejár · {stockExpires}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Used in recipes */}
          {usingRecipes.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <span className="eyebrow" style={{ marginBottom: 8, display: 'block' }}>Receptekben · {usingRecipes.length}</span>
              <div className="col gap-xs">
                {usingRecipes.map(r => (
                  <div key={r.id} className="card notch-4 row" style={{ padding: '8px 10px', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{r.name}</span>
                    <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>{r.slot}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="col gap-sm">
            {/* Logolás stays deferred — no logging slice yet. */}
            <button className="cta-primary notch-4" disabled>
              <Icon name="plus" size={14} /> Logolás · mai étkezésbe
            </button>
            <div className="row gap-sm">
              <button className="cta-ghost notch-4 flex-1" onClick={bumpStock}>
                <Icon name="tool" size={12} /> Frissítés · +1 polcra
              </button>
              <button className="cta-ghost notch-4 flex-1" onClick={() => setEditOpen(true)}>
                <Icon name="settings" size={12} /> Szerkesztés
              </button>
            </div>
            <button
              className="cta-ghost notch-4"
              onClick={remove}
              style={{ color: 'var(--warning)', borderColor: 'var(--border-subtle)' }}
            >
              <Icon name="x" size={12} /> Törlés a kamrából
            </button>
          </div>

          {item.scrapedAt && (
            <div className="row gap-xs mt-md" style={{ justifyContent: 'center', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <Icon name="tool" size={9} color="var(--text-quaternary)" />
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-quaternary)' }}>
                scrape · {item.scrapedAt} · {item.source}
              </span>
            </div>
          )}

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
    <AddPantryItemSheet
      open={editOpen}
      onClose={() => setEditOpen(false)}
      editId={backendId}
      initial={inputFromItem(item)}
    />
    </>
  )
}
