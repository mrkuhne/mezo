// ============================================================
// Mezo · KamraItemDetailPage (Kamra — item detail PAGE) — Mozaik 2.0 re-face
// (mezo-d20.4.5, Kamra v2). Source of truth: docs/design_2.0/prototypes/
// src/fuel-body.html #page-kitem + 2026-08-27-fuel-design-iterations.md §5.
//
// Anatomy: MozaikPage(tone="gold")/PageHead("‹ Kamra") → monogram km-head
// (source badge + brand + category + NOVA) → food: tinted macro mcells +
// honest Tápanyag ncells (null → "—", never a fabricated 0) → supp/stim/med:
// tinted dose cell + italic protocol + a "💊 a stackben · {zóna} {idő}"
// cross-link chip (reads today's live stack projection, useStackDay — the
// same composition FuelStackPage draws from) → Ár row → "Receptekben" chips
// cross-referencing Recipe.ingredients by pantryItemId (audit gap #5:
// usedInRecipes was read from the contract but never surfaced anywhere) →
// ＋ Logolás (food only) → two-tap Törlés ("biztos?" re-arm on the second
// press) that live-updates the shared usePantry() cache — the list's hero/
// stats/rows all read the same query, so deletion here reflects there with
// no extra plumbing.
//
// The FACE changed; mutations/contracts (usePantryActions, the 'stash-'
// backend-id strip, AddPantryItemSheet prefill, LogFlowPage prefill) are
// untouched.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { IngredientStock, PantryItem, PantryItemInput } from '@/data/types'
import { usePantry, usePantryActions, useStackDay, useRecipes } from '@/data/hooks'
import { buildKamraItems } from '@/features/fuel/logic/kamraItems'
import { SHOW_PANTRY_STOCK } from '@/data/_client/flags'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageBody, MCells, type MCell } from '@/shared/ui/mozaik'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { NovaDot } from '@/features/fuel/components/NovaDot'
import { AddPantryItemSheet } from '@/features/fuel/sheets/AddPantryItemSheet'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'

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
  // Null macro = "no data on the shared definition" (mezo-6omv). It must stay OUT of the request:
  // the DTO cannot distinguish an omitted field from an explicit null, and applyDefinitionPartial
  // reads "absent" as "leave unchanged". Assigning null here would send `kcal: null` and blank the
  // field on a definition every other user reads.
  if (item.macros) {
    if (item.macros.kcal != null) base.kcal = item.macros.kcal
    if (item.macros.p != null) base.proteinG = item.macros.p
    if (item.macros.c != null) base.carbsG = item.macros.c
    if (item.macros.f != null) base.fatG = item.macros.f
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

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'center', gap: 8, margin: '16px 2px 8px' }}>
      <span className="mz-eyebrow" style={{ fontSize: 9 }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}

// Honest nutrient cell — a missing value renders the DASH class, never a fabricated 0.
function NCell({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <span>
      {value == null ? <b className="dash">—</b> : <b>{value} g</b>}
      <small>{label}</small>
    </span>
  )
}

export function KamraItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { ingredients, stash, categoryMeta } = usePantry()
  const { deleteItem } = usePantryActions()
  const { recipes } = useRecipes()
  const { slots } = useStackDay()
  const [editOpen, setEditOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [delArmed, setDelArmed] = useState(false)

  const item = buildKamraItems(ingredients, stash).find(it => it.id === id)

  if (!item) {
    return (
      <MozaikPage tone="gold">
        <PageHead onBack={() => navigate('/fuel/kamra')} label="‹ Kamra" />
        <PageBody>
          <div className="card" style={{ padding: 20, textAlign: 'center' }}>
            <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs ilyen tétel.</span>
          </div>
        </PageBody>
      </MozaikPage>
    )
  }

  // buildKamraItems prefixes stash (supplement/stim/med) card ids with 'stash-'
  // to keep them collision-free against food ingredient ids. Mutations target the
  // BACKEND id (the raw mock id / real UUID) — strip the prefix once here. Food
  // cards carry the raw ingredient id, so this is a no-op for them.
  const backendId = item.id.startsWith('stash-') ? item.id.slice('stash-'.length) : item.id
  // The stack's occurrences key by the STASH id even for items that also have a food-shaped
  // Ingredient row (kreatin/whey carry BOTH — buildKamraItems represents them by their
  // ingredient id, not 'stash-<id>'): prefer stashRefId when present, else the backend id.
  const stackKey = item.stashRefId ?? backendId
  const catColor = categoryMeta[item.category]?.color ?? 'var(--text-secondary)'
  const catLabel = categoryMeta[item.category]?.label ?? item.category

  const stock = item.stock ?? null
  const stockQty: number | undefined = stock?.qty
  const stockUnit: string | undefined = stock?.unit
  const hasStock = stock != null && typeof stockQty === 'number'
  const stockExpires = stock && isFullStock(stock) ? stock.expires : undefined

  // "💊 a stackben · {zóna} {idő}" cross-link — today's live stack projection, the
  // same composition FuelStackPage reads. Hidden when this item has no occurrence today.
  const stackSlot = slots.find(s => s.entries.some(e => e.pantryItemId === stackKey))

  // "Receptekben" chips (audit gap #5 — usedInRecipes was read from the contract but never
  // displayed anywhere): the real recipe names that reference this pantry item, not the bare
  // count, computed from the live Recipe.ingredients rather than trusting a stale counter.
  const usedInRecipes = recipes.filter(r => r.ingredients.some(l => l.refId === backendId))

  const remove = () => {
    if (!delArmed) { setDelArmed(true); return }
    deleteItem(backendId)
    navigate('/fuel/kamra')
  }

  const hasAnyMacro = item.macros != null
    && (item.macros.kcal != null || item.macros.p != null || item.macros.c != null || item.macros.f != null)
  const g = (v: number | null) => (v == null ? '—' : `${v} g`)
  const macroCells: MCell[] | null = hasAnyMacro && item.macros
    ? [
        { label: 'kcal', value: item.macros.kcal ?? '—', tone: 'sage' },
        { label: 'fehérje', value: g(item.macros.p), tone: 'coral' },
        { label: 'szénh.', value: g(item.macros.c), tone: 'gold' },
        { label: 'zsír', value: g(item.macros.f), tone: 'lav' },
      ]
    : null

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/fuel/kamra')} label="‹ Kamra">
        <button type="button" className="pgact" style={{ marginLeft: 'auto' }} onClick={() => setEditOpen(true)}>
          <Icon name="settings" size={12} /> Szerkesztés
        </button>
      </PageHead>

      <PageBody>
        <div className="km-head">
          <span className={`km-thumb km-k-${item.kind}`} aria-hidden="true">{item.name.charAt(0).toUpperCase()}</span>
          <h1 className="nm" id="kamra-item-title">{item.name}</h1>
          <div className="sb">
            <SourceBadge source={item.source} size="lg" />
            {item.brand && <span>{item.brand}</span>}
            <span>·</span>
            <span style={{ color: catColor }}>{catLabel}</span>
            {item.nova != null && (
              <>
                <span>·</span>
                <NovaDot nova={item.nova} />
              </>
            )}
            {item.sharedFrom && (
              <>
                <span>·</span>
                <span style={{ color: 'var(--mz-cell-sage-ink)' }}>közös · {item.sharedFrom.authorName}</span>
              </>
            )}
          </div>
        </div>

        {macroCells && (
          <>
            <SectionHead>Makrók{item.per ? ` · /${item.per}${item.unit ?? ''}` : ''}</SectionHead>
            <MCells cells={macroCells} />

            <SectionHead>Tápanyag</SectionHead>
            <div className="km-ncells">
              <NCell label="rost" value={item.fiberG} />
              <NCell label="cukor" value={item.sugarG} />
              <NCell label="tel. zsír" value={item.saturatedFatG} />
              <NCell label="só" value={item.saltG} />
            </div>
          </>
        )}

        {/* Dose/protocol/stack-chip is a KIND fact (any supp/stim/med row), independent of
            whether this particular item also carries a macros object — mezo-1za9 lets
            supplements carry real nutrition data too (kreatin/whey), so both sections can
            legitimately coexist for the same item. */}
        {item.kind !== 'food' && (
          <>
            <SectionHead>Dózis · protokoll</SectionHead>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <div className={`km-cell km-k-${item.kind}`} style={{ marginLeft: 0 }}>
                <b>{item.dose ?? '—'}</b>
                <small>dózis</small>
              </div>
              {item.protocol && (
                <span className="text-tertiary" style={{ fontSize: 11, fontStyle: 'italic' }}>{item.protocol}</span>
              )}
            </div>
            {stackSlot && (
              <span className="km-stkchip">💊 a stackben · {stackSlot.label} {stackSlot.time}</span>
            )}
          </>
        )}

        <SectionHead>{SHOW_PANTRY_STOCK ? 'Készlet · ár' : 'Ár'}</SectionHead>
        <div className="row gap-sm">
          {SHOW_PANTRY_STOCK && (
            <div className="card col" style={{ padding: 8, gap: 2, alignItems: 'flex-start', flex: 1 }}>
              <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>Készlet</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: 600 }}>
                {hasStock ? `${stockQty} ${stockUnit}${stockExpires ? ` · ${stockExpires}` : ''}` : '—'}
              </span>
            </div>
          )}
          <div className="card col" style={{ padding: 8, gap: 2, alignItems: 'flex-start', flex: 1 }}>
            <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>Ár</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: 600 }}>{item.price ? `${item.price} Ft` : '—'}</span>
          </div>
        </div>

        {usedInRecipes.length > 0 && (
          <>
            <SectionHead>Receptekben · {usedInRecipes.length}</SectionHead>
            <div className="km-rchips">
              {usedInRecipes.map(r => <span key={r.id}>{r.name}</span>)}
            </div>
          </>
        )}

        <div style={{ marginTop: 18 }}>
          {hasAnyMacro && (
            <button className="cta-primary" onClick={() => setLogOpen(true)}>
              <Icon name="plus" size={14} /> Logolás · mai étkezésbe
            </button>
          )}
          <button className="km-delbtn" onClick={remove}>
            {delArmed ? 'Biztos? Még egy érintés a törléshez' : 'Törlés'}
          </button>
        </div>
      </PageBody>

      <AddPantryItemSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editId={backendId}
        initial={inputFromItem(item)}
        definitionLocked={item.catalogEditable === false}
      />
      {logOpen && <LogFlowPage prefill={{ source: 'pantry', pantryItemId: backendId }} onClose={() => setLogOpen(false)} />}
    </MozaikPage>
  )
}
