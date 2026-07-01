// ============================================================
// Mezo · FuelKamraView (Kamra — pantry sub-view)
// Direction A (kamra-mockup-v3-A): the pantry inventory restyled to the agreed
// design — a type segmented switcher (Mind/Étel/Supp/Stim) as the primary axis,
// the 4-cell stats strip, a "needs attention" strip, a compact filter bar (search
// + a "Szűrők" button that opens the CategoryFilterSheet bottom-sheet; active
// categories show as removable pills), and the type-grouped list of design-system
// KamraCards (colored nub dividers per type), plus an empty-state for a fresh pantry.
//
// Tapping a card NAVIGATES to /fuel/kamra/:id (the detail is a full page now, not a
// drawer — kills the old drawer-in-drawer edit problem).
//
// Renders directly into the app-shell .screen-content (no nested wrapper — the
// old wrapper double-offset the scrollport and left a large top gap).
//
// Placeholder/mock UI removed (returns with the real features in later slices):
// the scrape-feed card + ImportItemSheet, the Mezo suggestions feed. Data is
// backend-backed via usePantry().
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PantryItem } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { buildKamraItems } from '@/features/fuel/kamraItems'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { StatCell } from '@/components/ui/StatCell'
import { KamraCard } from '@/features/fuel/components/KamraCard'
import { AddPantryItemSheet } from '@/features/fuel/AddPantryItemSheet'
import { CategoryFilterSheet, categoryOption } from '@/features/fuel/CategoryFilterSheet'
import { SHOW_PANTRY_STOCK } from '@/lib/flags'
import KamraSkeleton from '@/features/fuel/views/KamraSkeleton'

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

export function FuelKamraView() {
  const navigate = useNavigate()
  const { ingredients, stash, categoryMeta, pending } = usePantry()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const allItems = buildKamraItems(ingredients, stash)
  const ingItems = allItems.filter(it => !it.isStashOnly)

  const counts: Record<string, number> = { all: allItems.length }
  allItems.forEach(it => { counts[it.kind] = (counts[it.kind] ?? 0) + 1 })

  // The list filter ANDs three axes: type switcher AND selected categories AND search.
  // Passing an explicit `cats` lets callers probe a draft selection (the filter sheet's
  // live tally) or skip the category axis entirely (cats=[] → category-count options).
  const matches = (it: PantryItem, cats: string[]) => {
    if (typeFilter !== 'all' && it.kind !== typeFilter) return false
    if (cats.length > 0 && !cats.includes(it.category)) return false
    if (query && !(it.name + ' ' + it.brand).toLowerCase().includes(query.toLowerCase())) return false
    return true
  }

  const filtered = allItems.filter(it => matches(it, categoryFilter))

  // Category options for the filter sheet — only categories PRESENT among the items
  // that pass the OTHER axes (type + search; matches(it, []) skips the category axis),
  // each with a count, sorted by size.
  const catCounts = new Map<string, number>()
  allItems.filter(it => matches(it, [])).forEach(it => {
    catCounts.set(it.category, (catCounts.get(it.category) ?? 0) + 1)
  })
  const categoryOptions = [...catCounts.entries()]
    .map(([key, count]) => categoryOption(key, count))
    .sort((a, b) => b.count - a.count)

  const byType: Record<string, PantryItem[]> = {}
  filtered.forEach(it => { (byType[it.kind] = byType[it.kind] ?? []).push(it) })

  const lowExpiry = ingItems.filter(i => i.stock && 'lowExpiry' in i.stock && i.stock.lowExpiry).length
  const lowStock = stash.filter(s => s.stock !== null && s.stock < 15).length
  const isEmpty = allItems.length === 0

  // Real-mode loading window — skeleton before the empty-state branch (hooks are
  // all above, so hook order stays stable). Mock mode never sets pending (mezo-f2z).
  if (pending) return <KamraSkeleton />

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
              {/* Stock stats hidden — stock tracking deferred (mezo-6nu) */}
              {SHOW_PANTRY_STOCK && (
                <>
                  <StatCell label="Lejár" val={String(lowExpiry)} sub="< 3 nap" color={lowExpiry ? 'var(--warning)' : 'var(--text-tertiary)'} />
                  <StatCell label="Fogy" val={String(lowStock)} sub="< 15 adag" color={lowStock ? 'var(--warning)' : 'var(--text-tertiary)'} />
                </>
              )}
            </div>
          </div>

          {/* Needs-attention strip (stock expiry — deferred, mezo-6nu) */}
          {SHOW_PANTRY_STOCK && lowExpiry > 0 && (
            <div style={{ padding: '0 24px 12px' }}>
              <div className="notch-4" style={{ padding: '10px 14px', background: 'color-mix(in srgb, var(--warning) 7%, transparent)', borderLeft: '2px solid var(--warning)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{lowExpiry} tétel hamarosan lejár</span> — nézd át a leltárt.
                </span>
              </div>
            </div>
          )}

          {/* Compact filter bar — search + a "Szűrők" button (badge = active filter count) */}
          <div className="row gap-sm" style={{ padding: '0 24px 8px', alignItems: 'stretch' }}>
            <div className="notch-8 row gap-sm flex-1" style={{ padding: '9px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', alignItems: 'center' }}>
              <Icon name="search" size={12} color="var(--text-tertiary)" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Keress tétel, márka…"
                style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ color: 'var(--text-tertiary)' }} aria-label="Keresés törlése">
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
            <button
              onClick={() => setFilterOpen(true)}
              className="notch-8 row gap-xs"
              style={{
                alignItems: 'center', padding: '9px 13px',
                fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--brand-glow)', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(94,234,212,0.3)',
              }}
            >
              <Icon name="settings" size={12} /> Szűrők
              {categoryFilter.length > 0 && (
                <span style={{ background: 'var(--brand-primary)', color: 'var(--text-inverse)', fontSize: 9, padding: '0 5px', borderRadius: 8 }}>
                  {categoryFilter.length}
                </span>
              )}
            </button>
          </div>

          {/* Active category pills — removable */}
          {categoryFilter.length > 0 && (
            <div className="row gap-xs flex-wrap" style={{ padding: '0 24px 14px' }}>
              {categoryFilter.map(key => {
                const meta = categoryMeta[key]
                return (
                  <button
                    key={key}
                    onClick={() => setCategoryFilter(cs => cs.filter(c => c !== key))}
                    className="notch-8 row gap-xs"
                    style={{
                      alignItems: 'center', padding: '4px 9px',
                      fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase',
                      color: 'var(--brand-glow)', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(94,234,212,0.3)',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta?.color ?? 'var(--success)', flexShrink: 0 }} />
                    {meta?.label ?? key}
                    <Icon name="x" size={9} />
                  </button>
                )
              })}
            </div>
          )}
          {categoryFilter.length === 0 && <div style={{ height: 8 }} />}

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
                    <KamraCard key={it.id} item={it} onOpen={() => navigate(`/fuel/kamra/${it.id}`)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {filterOpen && (
        <CategoryFilterSheet
          options={categoryOptions}
          selected={categoryFilter}
          totalIfApplied={draft => allItems.filter(it => matches(it, draft)).length}
          onApply={setCategoryFilter}
          onClose={() => setFilterOpen(false)}
        />
      )}
      <AddPantryItemSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
