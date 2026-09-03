// ============================================================
// Mezo · FuelKamraPage (Kamra — pantry sub-view) — Mozaik 2.0 re-face
// (mezo-d20.4.5, Kamra v2). Source of truth: docs/design_2.0/prototypes/
// src/fuel-body.html #page-kamra + 2026-08-27-fuel-design-iterations.md §5.
//
// Anatomy: MozaikPage(tone="gold")/PageHead("‹ Fuel")/PageHero(i-kamra,
// big=item count) → stat strip → type switcher (Mind/Étel/Supp/Stim/
// GYÓGYSZER — the audit's gap #19, a segment the old switcher never had) →
// search + Szűrők → type-grouped kind-washed KamraCard rail cards → the
// ✨ Mezo javaslatok card + Legutóbbi importok rows, BOTH real
// hidden-when-empty surfaces per the honest-state contract.
//
// The FACE changed; the data layer (usePantry, buildKamraItems, the
// type/category/search AND-filter, the category-options-sorted-by-count
// sheet) is untouched — this re-skins Direction A, it does not reinvent it.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PantryItem } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { buildKamraItems } from '@/features/fuel/logic/kamraItems'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageHero, PageBody, StatStrip, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { KamraCard } from '@/features/fuel/components/KamraCard'
import { SuggestionCard } from '@/features/fuel/components/SuggestionCard'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { AddPantryItemSheet } from '@/features/fuel/sheets/AddPantryItemSheet'
import { ImportItemSheet } from '@/features/fuel/sheets/ImportItemSheet'
import { CategoryFilterSheet, categoryOption } from '@/features/fuel/sheets/CategoryFilterSheet'
import { SHOW_PANTRY_STOCK } from '@/data/_client/flags'
import KamraSkeleton from '@/features/fuel/pages/KamraSkeleton'

const TYPE_SWITCHER = [
  { id: 'all', label: 'Mind' },
  { id: 'food', label: 'Étel' },
  { id: 'supplement', label: 'Supp' },
  { id: 'stim', label: 'Stim' },
  { id: 'med', label: 'Gyógyszer' },
] as const

// Section meta keyed by kind — order is the canonical food → supplement → stim → med
// (audit risk #8; never re-sort this).
const TYPE_META: Record<string, { label: string }> = {
  food: { label: 'Étel' },
  supplement: { label: 'Supplement' },
  stim: { label: 'Stimuláns' },
  med: { label: 'Gyógyszer' },
}
const TYPE_ORDER = ['food', 'supplement', 'stim', 'med'] as const

export function FuelKamraPage() {
  const navigate = useNavigate()
  const { ingredients, stash, categoryMeta, imports, suggestions, pending } = usePantry()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const allItems = buildKamraItems(ingredients, stash)

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

  // Stock/expiry stats — behind SHOW_PANTRY_STOCK (deferred, mezo-6nu); inert while off.
  const ingItems = allItems.filter(it => !it.isStashOnly)
  const lowExpiry = ingItems.filter(i => i.stock && 'lowExpiry' in i.stock && i.stock.lowExpiry).length
  const lowStock = stash.filter(s => s.stock !== null && s.stock < 15).length

  const isEmpty = allItems.length === 0
  // The hero number counts up (the prototype's big number arrives with the page, and
  // `useCountUp` settles instantly under prefers-reduced-motion).
  const heroCount = useCountUp(allItems.length)

  // Real-mode loading window — skeleton before the empty-state branch (hooks are
  // all above, so hook order stays stable). Mock mode never sets pending (mezo-f2z).
  if (pending) return <KamraSkeleton />

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/fuel')} label="‹ Fuel">
        <button type="button" className="pgact" onClick={() => setImportOpen(true)}>
          <Icon name="search" size={12} /> Import
        </button>
        <button type="button" className="pgact" style={{ marginLeft: 6 }} onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={12} /> Új tétel
        </button>
      </PageHead>

      <EntranceGroup>
      <PageHero icon="i-kamra" big={heroCount} name="Kamra" kalauzAnchor="kamra-hero" />

      <PageBody>
        {isEmpty ? (
          <div className="card col" style={{ padding: 28, alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 17, color: 'var(--text-primary)' }}>A kamra üres</span>
            <span className="text-tertiary" style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 250 }}>
              Vedd fel az első tételt — ételt vagy supplementet —, és itt jelenik meg a leltárban.
            </span>
            <button onClick={() => setAddOpen(true)} className="chip brand mt-sm" style={{ padding: '10px 16px' }}>
              <Icon name="plus" size={12} /> Első tétel felvétele
            </button>
          </div>
        ) : (
          <>
            {/* Stats strip */}
            <div className="rise" style={{ '--d': '20ms' } as React.CSSProperties}>
            <StatStrip>
              <StatCell value={allItems.length} label="tétel" />
              <StatCell value={counts.food ?? 0} label="étel" />
              <StatCell value={counts.med ?? 0} label="protokollos" />
              <StatCell value={imports.length} label="import e héten" />
              {SHOW_PANTRY_STOCK && (
                <>
                  <StatCell value={lowExpiry} label="< 3 nap" />
                  <StatCell value={lowStock} label="< 15 adag" />
                </>
              )}
            </StatStrip>
            </div>

            {/* Needs-attention strip (stock expiry — deferred, mezo-6nu) */}
            {SHOW_PANTRY_STOCK && lowExpiry > 0 && (
              <div className="rad-12" style={{ margin: '10px 0', padding: '10px 14px', background: 'color-mix(in srgb, var(--warning) 7%, transparent)', borderLeft: '2px solid var(--warning)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{lowExpiry} tétel hamarosan lejár</span> — nézd át a leltárt.
                </span>
              </div>
            )}

            {/* Type switcher — the primary axis; med gets its OWN segment now (audit gap #19) */}
            <div className="row rise" style={{ '--d': '40ms', gap: 5, padding: 5, margin: '11px 0 12px', background: 'var(--mz-cellbg)', border: '1px solid var(--border-subtle)', borderRadius: 14 } as React.CSSProperties}>
              {TYPE_SWITCHER.map(t => {
                const active = typeFilter === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTypeFilter(t.id)}
                    className="rad-16 col flex-1"
                    style={{ alignItems: 'center', padding: '9px 0 8px', background: active ? 'var(--coral)' : 'transparent' }}
                  >
                    <span style={{ fontFamily: 'var(--ff-display)', fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', color: active ? 'var(--text-inverse)' : 'var(--text-secondary)' }}>{t.label}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 9, marginTop: 3, color: active ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>{counts[t.id] ?? 0}</span>
                  </button>
                )
              })}
            </div>

            {/* Search + Szűrők */}
            <div className="row gap-sm rise" style={{ '--d': '60ms', marginBottom: 8, alignItems: 'stretch' } as React.CSSProperties}>
              <div className="rad-16 row gap-sm flex-1" style={{ padding: '9px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', alignItems: 'center' }}>
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
                className="rad-16 row gap-xs"
                style={{
                  alignItems: 'center', padding: '9px 13px',
                  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--mz-cell-sage-ink)', background: 'var(--mz-cell-sage-bg)', border: '1px solid color-mix(in srgb, var(--sage) 30%, transparent)',
                }}
              >
                <Icon name="settings" size={12} /> Szűrők
                {categoryFilter.length > 0 && (
                  <span style={{ background: 'var(--coral)', color: 'var(--text-inverse)', fontSize: 9, padding: '0 5px', borderRadius: 8 }}>
                    {categoryFilter.length}
                  </span>
                )}
              </button>
            </div>

            {/* Active category pills — removable */}
            {categoryFilter.length > 0 && (
              <div className="row gap-xs flex-wrap" style={{ marginBottom: 14 }}>
                {categoryFilter.map(key => {
                  const meta = categoryMeta[key]
                  return (
                    <button
                      key={key}
                      onClick={() => setCategoryFilter(cs => cs.filter(c => c !== key))}
                      className="rad-16 row gap-xs"
                      style={{
                        alignItems: 'center', padding: '4px 9px',
                        fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase',
                        color: 'var(--mz-cell-sage-ink)', background: 'var(--mz-cell-sage-bg)', border: '1px solid color-mix(in srgb, var(--sage) 30%, transparent)',
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

            {/* Type-grouped list — "Polc" (shelf) list-section head, prototype .lsthead */}
            <div className="fh-lsthead rise" style={{ '--d': '90ms' } as React.CSSProperties}>
              <span className="mz-eyebrow">Polc</span>
              <span className="cnt">{filtered.length} / {allItems.length}</span>
            </div>
            {filtered.length === 0 && (
              <div className="fh-nohit rise" style={{ '--d': '110ms' } as React.CSSProperties}>Nincs egyező tétel.</div>
            )}
            {TYPE_ORDER.filter(k => byType[k]?.length).map(kind => (
              <div key={kind} style={{ marginBottom: 16 }}>
                <div className={`km-sec km-k-${kind}`}>
                  <i />
                  <span className="t">{TYPE_META[kind].label}</span>
                  <span className="n">· {byType[kind].length}</span>
                  <span className="rule" />
                </div>
                {byType[kind].map(it => (
                  <KamraCard key={it.id} item={it} onOpen={() => navigate(`/fuel/kamra/${it.id}`)} />
                ))}
              </div>
            ))}

            {/* Mezo suggestions — deterministic swap heuristics (P6, mezo-bka); hidden when empty */}
            {suggestions.length > 0 && (
              <div className="rise" style={{ '--d': '120ms', marginBottom: 20 } as React.CSSProperties}>
                <div className="row" style={{ marginBottom: 9, alignItems: 'center', gap: 8 }}>
                  <Icon name="sparkle" size={11} color="var(--mz-cell-sage-ink)" />
                  <span className="mz-eyebrow">Mezo javaslatok</span>
                </div>
                <div className="col gap-sm">
                  {suggestions.map((sug, i) => <SuggestionCard key={`${sug.name}-${i}`} sug={sug} />)}
                </div>
              </div>
            )}

            {/* Recent imports feed (P6, mezo-bka); hidden when empty */}
            {imports.length > 0 && (
              <div className="rise" style={{ '--d': '150ms', marginBottom: 12 } as React.CSSProperties}>
                <div className="row" style={{ marginBottom: 9, alignItems: 'center', gap: 8 }}>
                  <span className="mz-eyebrow">Legutóbbi importok</span>
                </div>
                <div className="card" style={{ padding: '0 14px' }}>
                  {imports.map(imp => (
                    <div key={imp.id} className="km-improw">
                      <SourceBadge source={imp.source} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imp.ofWhat}</span>
                      {imp.status === 'manual-review' && <span className="chk">ellenőrzés</span>}
                      <span className="when">{imp.when}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </PageBody>
      </EntranceGroup>

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
      {importOpen && <ImportItemSheet onClose={() => setImportOpen(false)} />}
    </MozaikPage>
  )
}
