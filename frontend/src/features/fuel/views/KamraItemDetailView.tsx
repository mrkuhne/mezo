// ============================================================
// Mezo · KamraItemDetailView (Kamra — item detail PAGE)
// The pantry-item detail is now a full route (/fuel/kamra/:id) instead of a
// bottom-sheet drawer — this kills the old "drawer-in-drawer" problem: the
// Szerkesztés editor (AddPantryItemSheet) opens cleanly OVER this page.
//
// Layout (docs/design/kamra-detail-edit-v1.html · phone 2), chamfer chrome:
//   back (‹) + eyebrow → source pill → big Antonio name → category · NOVA →
//   Makrók (4 notch-4 cells) → Tápanyag (4 notch-4 cells) → Készlet · ár →
//   actions (Logolás → opens LogMealSheet pre-filled, Szerkesztés, Törlés).
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { IngredientStock, PantryItem, PantryItemInput } from '@/data/types'
import { usePantry, usePantryActions } from '@/data/hooks'
import { buildKamraItems } from '@/features/fuel/kamraItems'
import { SHOW_PANTRY_STOCK } from '@/lib/flags'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { NovaDot } from '@/features/fuel/components/NovaDot'
import { AddPantryItemSheet } from '@/features/fuel/AddPantryItemSheet'
import { LogMealSheet } from '@/features/fuel/LogMealSheet'

// The full IngredientStock carries expires/lowExpiry; the bare { qty, unit }
// stock shape does not. Narrow once instead of fighting `in`-narrowing in JSX.
function isFullStock(s: NonNullable<PantryItem['stock']>): s is IngredientStock {
  return 'expires' in s
}

// Build a complete PantryItemInput from the displayed item — prefills every
// field of the edit sheet so an edit preserves untouched values. Moved here from
// the retired IngredientDetailSheet.
export function inputFromItem(item: PantryItem): PantryItemInput {
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
  if (item.fiberG != null) base.fiberG = item.fiberG
  if (item.sugarG != null) base.sugarG = item.sugarG
  if (item.saltG != null) base.saltG = item.saltG
  if (item.saturatedFatG != null) base.saturatedFatG = item.saturatedFatG
  if (item.price != null) base.price = item.price
  if (item.priceUnit) base.priceUnit = item.priceUnit
  if (item.pkg) base.pkg = item.pkg
  if (item.dose) base.dose = item.dose
  if (item.form) base.form = item.form
  if (item.protocol) base.protocol = item.protocol
  return base
}

// A single notch-4 nutrition/stock cell: label on top, value below.
function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card notch-4 col" style={{ padding: 8, gap: 2, alignItems: 'flex-start' }}>
      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 15, fontWeight: 600, color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'center', gap: 8, margin: '18px 2px 9px' }}>
      <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}

const grid4 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 } as const
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 } as const

export function KamraItemDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { ingredients, stash, categoryMeta } = usePantry()
  const { deleteItem } = usePantryActions()
  const [editOpen, setEditOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  const item = buildKamraItems(ingredients, stash).find(it => it.id === id)

  if (!item) {
    return (
      <div style={{ padding: '0 24px' }}>
        <button
          onClick={() => navigate('/fuel/kamra')}
          className="notch-8"
          style={{ width: 32, height: 32, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, marginBottom: 14 }}
          aria-label="Vissza"
        >‹</button>
        <div className="card notch-4" style={{ padding: 20, textAlign: 'center' }}>
          <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs ilyen tétel.</span>
        </div>
      </div>
    )
  }

  // buildKamraItems prefixes stash (supplement/stim/med) card ids with 'stash-'
  // to keep them collision-free against food ingredient ids. Mutations target the
  // BACKEND id (the raw mock id / real UUID) — strip the prefix once here. Food
  // cards carry the raw ingredient id, so this is a no-op for them.
  const backendId = item.id.startsWith('stash-') ? item.id.slice('stash-'.length) : item.id
  const catColor = categoryMeta[item.category]?.color ?? 'var(--text-secondary)'
  const catLabel = categoryMeta[item.category]?.label ?? item.category

  const stock = item.stock ?? null
  const stockQty: number | undefined = stock?.qty
  const stockUnit: string | undefined = stock?.unit
  const hasStock = stock != null && typeof stockQty === 'number'
  const stockExpires = stock && isFullStock(stock) ? stock.expires : undefined

  const remove = () => {
    deleteItem(backendId)
    navigate('/fuel/kamra')
  }

  const fmt = (v: number | null | undefined) => (v != null ? v + 'g' : '—')

  return (
    <>
      <div style={{ padding: '0 24px 32px' }}>
        {/* Back + eyebrow */}
        <div className="row" style={{ alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button
            onClick={() => navigate('/fuel/kamra')}
            className="notch-8"
            style={{ width: 32, height: 32, flexShrink: 0, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}
            aria-label="Vissza"
          >‹</button>
          <Eyebrow brand>Kamra · tétel</Eyebrow>
        </div>

        {/* Source pill */}
        <div style={{ marginBottom: 8 }}>
          <SourceBadge source={item.source} size="lg" />
        </div>

        {/* Name */}
        <div id="kamra-item-title" style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1, margin: '6px 0 6px' }}>
          {item.name}
        </div>

        {/* Category · NOVA */}
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: catColor }}>{catLabel}</span>
          {item.nova != null && (
            <>
              <span className="text-tertiary" style={{ fontSize: 9 }}>·</span>
              <NovaDot nova={item.nova} />
            </>
          )}
        </div>

        {/* Makrók */}
        {item.macros && (
          <>
            <SectionHead>Makrók{item.per ? ` · /${item.per}${item.unit ?? ''}` : ''}</SectionHead>
            <div style={grid4}>
              <Cell label="kcal" value={String(item.macros.kcal)} color="var(--cat-tendency)" />
              <Cell label="P" value={String(item.macros.p)} color="var(--info)" />
              <Cell label="C" value={String(item.macros.c)} color="var(--warning)" />
              <Cell label="F" value={String(item.macros.f)} color="var(--cat-preference)" />
            </div>
          </>
        )}

        {/* Tápanyag — only for items that carry macros */}
        {item.macros && (
          <>
            <SectionHead>Tápanyag</SectionHead>
            <div style={grid4}>
              <Cell label="Rost" value={fmt(item.fiberG)} color="var(--success)" />
              <Cell label="Cukor" value={fmt(item.sugarG)} color="var(--warning)" />
              <Cell label="Tel.zsír" value={fmt(item.saturatedFatG)} color="var(--cat-preference)" />
              <Cell label="Só" value={fmt(item.saltG)} color="var(--text-secondary)" />
            </div>
          </>
        )}

        {/* Készlet · ár — stock hidden (deferred, mezo-6nu); dose kept, price kept */}
        <SectionHead>{SHOW_PANTRY_STOCK ? 'Készlet · ár' : item.dose ? 'Dózis · ár' : 'Ár'}</SectionHead>
        <div style={grid2}>
          {SHOW_PANTRY_STOCK ? (
            <Cell
              label="Készlet"
              value={hasStock ? `${stockQty} ${stockUnit}${stockExpires ? ` · ${stockExpires}` : ''}` : item.dose ? item.dose : '—'}
            />
          ) : (
            item.dose && <Cell label="Dózis" value={item.dose} />
          )}
          <Cell label="Ár" value={item.price ? `${item.price} Ft` : '—'} />
        </div>

        {/* Actions */}
        <div style={{ marginTop: 16 }}>
          <button className="cta-primary notch-4" onClick={() => setLogOpen(true)}>
            <Icon name="plus" size={14} /> Logolás · mai étkezésbe
          </button>
        </div>
        <div className="row gap-sm" style={{ marginTop: 8 }}>
          <button className="cta-ghost notch-4 flex-1" onClick={() => setEditOpen(true)}>
            <Icon name="settings" size={12} /> Szerkesztés
          </button>
          <button
            className="cta-ghost notch-4 flex-1"
            onClick={remove}
            style={{ color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)' }}
          >
            <Icon name="x" size={12} /> Törlés
          </button>
        </div>
      </div>

      <AddPantryItemSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editId={backendId}
        initial={inputFromItem(item)}
      />
      {logOpen && <LogMealSheet prefill={{ source: 'pantry', pantryItemId: backendId }} onClose={() => setLogOpen(false)} />}
    </>
  )
}
