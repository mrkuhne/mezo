// ============================================================
// Mezo · FuelKamraView (Kamra — pantry sub-view)
// Direction A (kamra-mockup-v3-A): the pantry inventory restyled to the agreed
// design — a type segmented switcher (Mind/Étel/Supp/Stim) as the primary axis,
// the 4-cell stats strip, a "needs attention" strip, search, a trimmed source
// filter, and the type-grouped list of design-system KamraCards (colored nub
// dividers per type), plus an empty-state for a fresh pantry.
//
// Renders directly into the app-shell .screen-content (no nested wrapper — the
// old wrapper double-offset the scrollport and left a large top gap).
//
// Placeholder/mock UI removed (returns with the real features in later slices):
// the scrape-feed card + ImportItemSheet, the Mezo suggestions feed, and the
// scrape-vendor source filters. Data is backend-backed via usePantry().
// ============================================================
import { useState } from 'react'
import type { PantryItem } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { buildKamraItems } from '@/features/fuel/kamraItems'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { StatCell } from '@/components/ui/StatCell'
import { KamraCard } from '@/features/fuel/components/KamraCard'
import { IngredientDetailSheet } from '@/features/fuel/IngredientDetailSheet'
import { AddPantryItemSheet } from '@/features/fuel/AddPantryItemSheet'

const TYPE_SWITCHER = [
  { id: 'all', label: 'Mind' },
  { id: 'food', label: 'Étel' },
  { id: 'supplement', label: 'Supp' },
  { id: 'stim', label: 'Stim' },
] as const

// Section meta keyed by kind (med folds into the 'Mind' view; rare, no switcher segment yet).
const TYPE_META: Record<string, { label: string; color: string }> = {
  food: { label: 'Étel', color: 'var(--brand-glow)' },
  supplement: { label: 'Supplement', color: 'var(--info)' },
  stim: { label: 'Stimuláns', color: 'var(--cat-tendency)' },
  med: { label: 'Gyógyszer', color: 'var(--error)' },
}
const TYPE_ORDER = ['food', 'supplement', 'stim', 'med'] as const

// Manual entry only until scrape/import lands — the scrape-vendor sources return then.
const SOURCE_FILTERS = [
  { id: 'all', label: 'Minden forrás' },
  { id: 'manual', label: 'Saját' },
] as const

export function FuelKamraView() {
  const { ingredients, stash } = usePantry()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [openIng, setOpenIng] = useState<PantryItem | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const allItems = buildKamraItems(ingredients, stash)
  const ingItems = allItems.filter(it => !it.isStashOnly)

  const counts: Record<string, number> = { all: allItems.length }
  allItems.forEach(it => { counts[it.kind] = (counts[it.kind] ?? 0) + 1 })

  const filtered = allItems.filter(it => {
    if (typeFilter !== 'all' && it.kind !== typeFilter) return false
    if (sourceFilter !== 'all' && it.source !== sourceFilter) return false
    if (query && !(it.name + ' ' + it.brand).toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const byType: Record<string, PantryItem[]> = {}
  filtered.forEach(it => { (byType[it.kind] = byType[it.kind] ?? []).push(it) })

  const lowExpiry = ingItems.filter(i => i.stock && 'lowExpiry' in i.stock && i.stock.lowExpiry).length
  const lowStock = stash.filter(s => s.stock !== null && s.stock < 15).length
  const isEmpty = allItems.length === 0

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>Fuel · Kamra</Eyebrow>
          <PageTitle className="mt-sm">Polc</PageTitle>
        </div>
        <button onClick={() => setAddOpen(true)} className="chip brand" style={{ padding: '8px 10px' }}>
          <Icon name="plus" size={12} /> Új tétel
        </button>
      </div>

      {isEmpty ? (
        <div style={{ padding: '0 24px' }}>
          <div className="card notch-12 col" style={{ padding: 28, alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 17, color: 'var(--text-primary)' }}>A kamra üres</span>
            <span className="text-tertiary" style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 250 }}>
              Vedd fel az első tételt — ételt vagy supplementet —, és itt jelenik meg a leltárban.
            </span>
            <button onClick={() => setAddOpen(true)} className="chip brand mt-sm" style={{ padding: '10px 16px' }}>
              <Icon name="plus" size={12} /> Első tétel felvétele
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Type switcher — the primary axis */}
          <div style={{ padding: '0 24px 14px' }}>
            <div className="row" style={{ gap: 5, padding: 5, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 14 }}>
              {TYPE_SWITCHER.map(t => {
                const active = typeFilter === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTypeFilter(t.id)}
                    className="notch-8 col flex-1"
                    style={{ alignItems: 'center', padding: '9px 0 8px', background: active ? 'var(--brand-primary)' : 'transparent' }}
                  >
                    <span style={{ fontFamily: 'var(--ff-display)', fontSize: 14, fontWeight: 600, letterSpacing: '0.02em', color: active ? 'var(--text-inverse)' : 'var(--text-secondary)' }}>{t.label}</span>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, marginTop: 3, color: active ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>{counts[t.id] ?? 0}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ padding: '0 24px 12px' }}>
            <div className="card notch-4 row" style={{ padding: 12, justifyContent: 'space-between' }}>
              <StatCell label="Tételek" val={String(allItems.length)} sub="a kamrában" color="var(--brand-glow)" />
              <StatCell label="Hozzávaló" val={String(counts.food ?? 0)} sub="étel" color="var(--info)" />
              <StatCell label="Lejár" val={String(lowExpiry)} sub="< 3 nap" color={lowExpiry ? 'var(--warning)' : 'var(--text-tertiary)'} />
              <StatCell label="Fogy" val={String(lowStock)} sub="< 15 adag" color={lowStock ? 'var(--warning)' : 'var(--text-tertiary)'} />
            </div>
          </div>

          {/* Needs-attention strip */}
          {lowExpiry > 0 && (
            <div style={{ padding: '0 24px 12px' }}>
              <div className="notch-4" style={{ padding: '10px 14px', background: 'color-mix(in srgb, var(--warning) 7%, transparent)', borderLeft: '2px solid var(--warning)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{lowExpiry} tétel hamarosan lejár</span> — nézd át a leltárt.
                </span>
              </div>
            </div>
          )}

          {/* Search */}
          <div style={{ padding: '0 24px 10px' }}>
            <div className="row gap-sm" style={{ padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', alignItems: 'center' }}>
              <Icon name="search" size={12} color="var(--text-tertiary)" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Keress tétel, márka…"
                style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ color: 'var(--text-tertiary)' }}>
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Source filter (trimmed to Minden + Saját) */}
          <div className="row gap-xs flex-wrap" style={{ padding: '0 24px 16px' }}>
            {SOURCE_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setSourceFilter(f.id)}
                className="chip"
                style={{
                  fontSize: 9,
                  padding: '5px 8px',
                  color: sourceFilter === f.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderColor: sourceFilter === f.id ? 'var(--border-strong)' : 'var(--border-subtle)',
                  background: sourceFilter === f.id ? 'var(--surface-2)' : 'transparent',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Type-grouped list */}
          <div style={{ padding: '0 24px 32px' }}>
            {filtered.length === 0 && (
              <div className="card notch-4" style={{ padding: 20, textAlign: 'center' }}>
                <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs egyező tétel.</span>
              </div>
            )}
            {TYPE_ORDER.filter(k => byType[k]?.length).map(kind => (
              <div key={kind} style={{ marginBottom: 18 }}>
                <div className="row" style={{ marginBottom: 10, alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 8, height: 8, background: TYPE_META[kind].color, flexShrink: 0 }} />
                  <span className="eyebrow">{TYPE_META[kind].label}</span>
                  <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>{byType[kind].length}</span>
                  <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--border-subtle), transparent)' }} />
                </div>
                <div className="col gap-sm">
                  {byType[kind].map(it => (
                    <KamraCard key={it.id} item={it} onOpen={() => setOpenIng(it)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {openIng && <IngredientDetailSheet item={openIng} onClose={() => setOpenIng(null)} />}
      <AddPantryItemSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
