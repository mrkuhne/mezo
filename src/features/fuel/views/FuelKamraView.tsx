// ============================================================
// Mezo · FuelKamraView (Kamra — pantry sub-view)
// Port: prototype/src/fuel-kamra.jsx FuelKamraView (23–209).
// Page header (Fuel · Kamra / Polc + Import chip → ImportItemSheet), a 4-cell
// stats strip, a scrape-feed card (recent imports → opens import), a controlled
// search input, the KAMRA_TYPE_FILTERS + KAMRA_SOURCE_FILTERS chip rows, the
// filtered+grouped KamraCard list (per-group header + count, empty-state), the
// Mezo · javaslatok suggestions feed, and the IngredientDetailSheet +
// ImportItemSheet overlays.
//
// Adaptations vs prototype:
//  - Data comes from usePantry() instead of window.MezoData; the unified item
//    list is built by the shared buildKamraItems() helper (fuel-kamra.jsx:32–52).
//  - The local KamraStat is the shared <StatCell> (label/val/sub/color contract);
//    StatCell expects a string val, so counts are stringified.
//  - Eyebrow / PageTitle / StatCell / SourceBadge / Icon / KamraCard /
//    SuggestionCard / IngredientDetailSheet / ImportItemSheet are the
//    already-built primitives. Import + filter chips stay native <button
//    className="chip"> (interactive, role=button) — the Chip primitive is a span.
// ============================================================
import { useState } from 'react'
import type { PantryItem } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { buildKamraItems } from '@/features/fuel/kamraItems'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { StatCell } from '@/components/ui/StatCell'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { KamraCard } from '@/features/fuel/components/KamraCard'
import { SuggestionCard } from '@/features/fuel/components/SuggestionCard'
import { IngredientDetailSheet } from '@/features/fuel/IngredientDetailSheet'
import { ImportItemSheet } from '@/features/fuel/ImportItemSheet'

const KAMRA_TYPE_FILTERS = [
  { id: 'all', label: 'Összes' },
  { id: 'food', label: 'Hozzávalók' },
  { id: 'supplement', label: 'Supplement' },
  { id: 'stim', label: 'Stimuláns' },
  { id: 'med', label: 'Gyógyszer' },
] as const

const KAMRA_SOURCE_FILTERS = [
  { id: 'all', label: 'Minden forrás' },
  { id: 'kifli.hu', label: 'kifli.hu' },
  { id: 'myprotein.hu', label: 'myprotein' },
  { id: 'tesco.hu', label: 'tesco' },
  { id: 'manual', label: 'saját' },
] as const

export function FuelKamraView() {
  const { ingredients, stash, categoryMeta, imports, suggestions } = usePantry()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [openIng, setOpenIng] = useState<PantryItem | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const allItems = buildKamraItems(ingredients, stash)
  const ingItems = allItems.filter(it => !it.isStashOnly)

  const filtered = allItems.filter(it => {
    if (typeFilter !== 'all' && it.kind !== typeFilter) return false
    if (sourceFilter !== 'all' && it.source !== sourceFilter) return false
    if (query && !(it.name + ' ' + it.brand).toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  // Group by category for browse mode.
  const grouped: Record<string, PantryItem[]> = {}
  filtered.forEach(it => {
    const key = categoryMeta[it.category]?.label ?? it.category ?? 'Egyéb'
    grouped[key] = grouped[key] ?? []
    grouped[key].push(it)
  })

  // Pantry quick stats.
  const lowExpiry = ingItems.filter(i => i.stock && 'lowExpiry' in i.stock && i.stock.lowExpiry).length
  const lowStock = stash.filter(s => s.stock !== null && s.stock < 15).length

  return (
    <>
      <div className="screen-content" style={{ paddingTop: 96 }}>
        <div className="page-header">
          <div>
            <Eyebrow brand>Fuel · Kamra</Eyebrow>
            <PageTitle className="mt-sm">Polc</PageTitle>
          </div>
          <button onClick={() => setImportOpen(true)} className="chip brand" style={{ padding: '8px 10px' }}>
            <Icon name="plus" size={12} /> Import
          </button>
        </div>

        {/* Pantry stats strip */}
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card notch-4 row" style={{ padding: 12, justifyContent: 'space-between' }}>
            <StatCell label="Tételek" val={String(allItems.length)} sub="a kamrában" color="var(--brand-glow)" />
            <StatCell label="Hozzávaló" val={String(ingItems.filter(i => i.kind === 'food').length)} sub="kifli + tesco" color="var(--cat-physiology)" />
            <StatCell label="Lejár" val={String(lowExpiry)} sub="< 3 nap" color={lowExpiry ? 'var(--warning)' : 'var(--text-tertiary)'} />
            <StatCell label="Fogy" val={String(lowStock)} sub="< 15 adag" color={lowStock ? 'var(--warning)' : 'var(--text-tertiary)'} />
          </div>
        </div>

        {/* Recent imports feed */}
        <div style={{ padding: '0 24px 12px' }}>
          <button
            onClick={() => setImportOpen(true)}
            className="card notch-4"
            style={{
              padding: 12,
              width: '100%',
              textAlign: 'left',
              background: 'var(--surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
              <Icon name="tool" size={12} color="var(--brand-glow)" />
              <div className="col flex-1">
                <span className="eyebrow brand">Scrape feed · utolsó 4 import</span>
                <div className="col gap-xs mt-sm">
                  {imports.slice(0, 3).map(imp => (
                    <div key={imp.id} className="row gap-sm" style={{ alignItems: 'center' }}>
                      <SourceBadge source={imp.source} />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {imp.items} tétel · {imp.ofWhat}
                      </span>
                      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{imp.when}</span>
                    </div>
                  ))}
                </div>
                <span className="label-mono brand mt-sm" style={{ fontSize: 9 }}>Új import →</span>
              </div>
            </div>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 24px 10px' }}>
          <div
            className="row gap-sm"
            style={{
              padding: '8px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              alignItems: 'center',
            }}
          >
            <Icon name="search" size={12} color="var(--text-tertiary)" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Keress tétel, márka, forrás…"
              style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ color: 'var(--text-tertiary)' }}>
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Type-filter chips */}
        <div className="row gap-xs flex-wrap" style={{ padding: '0 24px 6px' }}>
          {KAMRA_TYPE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={'chip' + (typeFilter === f.id ? ' brand' : '')}
              style={{ fontSize: 9, padding: '6px 10px' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Source-filter chips */}
        <div className="row gap-xs flex-wrap" style={{ padding: '0 24px 16px' }}>
          {KAMRA_SOURCE_FILTERS.map(f => (
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

        {/* Grouped list */}
        <div style={{ padding: '0 24px 12px' }}>
          {Object.keys(grouped).length === 0 && (
            <div className="card notch-4" style={{ padding: 20, textAlign: 'center' }}>
              <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs egyező tétel.</span>
            </div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} style={{ marginBottom: 18 }}>
              <div className="row" style={{ marginBottom: 10, justifyContent: 'space-between' }}>
                <span className="eyebrow">{group}</span>
                <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>{items.length}</span>
              </div>
              <div className="col gap-sm">
                {items.map(it => (
                  <KamraCard key={it.id} item={it} onOpen={() => setOpenIng(it)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Suggestions */}
        <div style={{ padding: '0 24px 32px' }}>
          <div className="row" style={{ marginBottom: 10, justifyContent: 'space-between' }}>
            <span className="eyebrow brand">Mezo · javaslatok</span>
            <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>auto-discover</span>
          </div>
          <div className="col gap-sm">
            {suggestions.map((s, i) => (
              <SuggestionCard key={i} sug={s} />
            ))}
          </div>
        </div>
      </div>

      {openIng && <IngredientDetailSheet item={openIng} onClose={() => setOpenIng(null)} />}
      {importOpen && <ImportItemSheet onClose={() => setImportOpen(false)} />}
    </>
  )
}
