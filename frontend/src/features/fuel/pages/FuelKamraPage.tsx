// ============================================================
// Mezo · FuelKamraPage (Kamra) — a Konyha másik ajtaja mögötti polc
// (Fuel Titanium S4, mezo-hygp; fagyasztott manifeszt B6 · B7 · B13).
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `kamraPage` (:83) + `pantryTile` (:78), a fuel-pages.css „Konyha v2" (:497) blokkjával.
// Anatómia: al-fejléc (‹ vissza + KONYHA/Kamra, a három felvevő-ajtóval) → kereső → típus-
// szűrők a saját darabszámukkal → két-hasábos csempe-rács → „Okosabb csere" (B13).
//
// B14 owner-DROP: a „Legutóbbi importok" feed LEVÁLT erről a lapról. Az import-rekord
// továbbra is íródik, de a per-tétel EREDET (forrás + mikor) a tétel részletlapjának
// forrás-kártyáján él — ott van értelme, nem egy külön listában. Ide NE kerüljön vissza.
// B16 owner-DROP: a készlet/lejárat felület a `SHOW_PANTRY_STOCK` zászló mögött alszik; ez a
// lap egy szót sem szól róla, és új hivatkozás sem készül rá.
//
// Változatlan viselkedés (csak az ARC változott): a `usePantry` adatút, a három tengelyen
// ANDolt szűrés (típus ÉS kategória ÉS keresés), a kategória-sheet darabszám szerint sorolt
// opciói, a valódi módú betöltő csontváz (mezo-f2z) és mind a négy felvevő-sheet.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PantryItem } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { buildKamraItems } from '@/features/fuel/logic/kamraItems'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { hu1, huInt } from '@/shared/lib/huNum'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { SuggestionCard } from '@/features/fuel/components/SuggestionCard'
import { AddPantryItemSheet } from '@/features/fuel/sheets/AddPantryItemSheet'
import { ImportItemSheet } from '@/features/fuel/sheets/ImportItemSheet'
import { CatalogSearchSheet } from '@/features/fuel/sheets/CatalogSearchSheet'
import { CategoryFilterSheet, categoryOption } from '@/features/fuel/sheets/CategoryFilterSheet'
import { pantryProvenance } from '@/features/fuel/logic/pantryProvenance'
import KamraSkeleton from '@/features/fuel/pages/KamraSkeleton'

const TYPE_FILTERS = [
  { id: 'all', label: 'Mind', color: 'var(--amber)', icon: null },
  { id: 'food', label: 'Étel', color: 'var(--sage)', icon: 'i-gabona' },
  { id: 'supplement', label: 'Supp', color: 'var(--lav)', icon: 'i-kiegeszito' },
  { id: 'stim', label: 'Stim', color: 'var(--coral)', icon: 'i-lang' },
  { id: 'med', label: 'Gyógyszer', color: 'var(--sky)', icon: 'i-injekcio' },
] as const satisfies readonly { id: string; label: string; color: string; icon: ClayIconName | null }[]

/** Egy tétel arca: ház-hue + clay szimbólum (a prototípus `pantryStyle`-ja ház-tokenekkel). */
const KIND_FACE: Record<string, { color: string; icon: ClayIconName }> = {
  food: { color: 'var(--sage)', icon: 'i-gabona' },
  supplement: { color: 'var(--lav)', icon: 'i-kiegeszito' },
  stim: { color: 'var(--coral)', icon: 'i-lang' },
  med: { color: 'var(--sky)', icon: 'i-injekcio' },
}

function PantryTile({ item, onOpen }: { item: PantryItem; onOpen: () => void }) {
  const face = KIND_FACE[item.kind] ?? { color: 'var(--amber)', icon: 'i-polc' as ClayIconName }
  const prov = pantryProvenance(item)
  const kcal = item.macros?.kcal ?? null
  const protein = item.macros?.p ?? null
  return (
    <button type="button" className="fkx-item rise"
      style={{ '--fkx': face.color } as React.CSSProperties} onClick={onOpen}>
      <span className="fkx-item-top">
        <span className="fkx-item-art" aria-hidden="true"><ClayIcon name={face.icon} size={42} /></span>
        <em title={prov.sourceLabel}><ClayIcon name={prov.icon} size={18} /></em>
      </span>
      <strong>{item.name}</strong>
      <span className="fkx-item-fact">
        {item.kind === 'food'
          ? (kcal == null ? <><b>—</b> nincs adat</> : <><b>{huInt(kcal)}</b> kcal / {item.per ?? 100}{item.unit ?? 'g'}</>)
          : (<><b>{item.dose ?? '—'}</b> adag</>)}
      </span>
      {item.kind === 'food' && protein != null && (
        <span className="fkx-protein">
          <i aria-hidden="true"><b style={{ '--w': `${Math.min(100, (protein / 25) * 100)}%` } as React.CSSProperties} /></i>
          <small>{hu1(protein)} g fehérje</small>
        </span>
      )}
      {item.brand && <span className="fkx-item-amount">{item.brand}</span>}
    </button>
  )
}

export function FuelKamraPage() {
  const navigate = useNavigate()
  const { ingredients, stash, categoryMeta, suggestions, pending } = usePantry()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)

  const allItems = buildKamraItems(ingredients, stash)

  const counts: Record<string, number> = { all: allItems.length }
  allItems.forEach(it => { counts[it.kind] = (counts[it.kind] ?? 0) + 1 })

  // The list filter ANDs three axes: type switcher AND selected categories AND search.
  // Passing an explicit `cats` lets callers probe a draft selection (the filter sheet's
  // live tally) or skip the category axis entirely (cats=[] → category-count options).
  const matches = (it: PantryItem, cats: string[]) => {
    if (typeFilter !== 'all' && it.kind !== typeFilter) return false
    if (cats.length > 0 && !cats.includes(it.category ?? '')) return false
    if (query && !(it.name + ' ' + (it.brand ?? '')).toLowerCase().includes(query.toLowerCase())) return false
    return true
  }

  const filtered = allItems.filter(it => matches(it, categoryFilter))

  // Category options for the filter sheet — only categories PRESENT among the items
  // that pass the OTHER axes (type + search; matches(it, []) skips the category axis),
  // each with a count, sorted by size.
  const catCounts = new Map<string, number>()
  allItems.filter(it => matches(it, [])).forEach(it => {
    const cat = it.category ?? ''
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1)
  })
  const categoryOptions = [...catCounts.entries()]
    .map(([key, count]) => categoryOption(key, count))
    .sort((a, b) => b.count - a.count)

  // Real-mode loading window — skeleton before the empty-state branch (hooks are
  // all above, so hook order stays stable). Mock mode never sets pending (mezo-f2z).
  if (pending) return <KamraSkeleton />

  return (
    <div className="fmx-page fkx-library">
      <EntranceGroup>
        <div className="fmx-subhead">
          <button type="button" onClick={() => navigate('/fuel/konyha')} aria-label="Vissza a Konyhába">‹</button>
          <span>
            <small>KONYHA</small>
            <strong>Kamra</strong>
          </span>
        </div>

        <div className="fkx-head-acts">
          <button type="button" className="fkx-head-act" onClick={() => setCatalogOpen(true)}>Közös</button>
          <button type="button" className="fkx-head-act" onClick={() => setImportOpen(true)}>Import</button>
          <button type="button" className="fkx-head-act" onClick={() => setAddOpen(true)}>＋ Új tétel</button>
        </div>

        {allItems.length === 0 ? (
          <div className="fkx-empty">
            <span aria-hidden="true"><ClayIcon name="i-polc" size={52} /></span>
            <strong>A kamra üres</strong>
            <p>Vedd fel az első tételt — vagy válassz a közös katalógusból —, és itt jelenik meg a polcodon.</p>
            <button type="button" onClick={() => setAddOpen(true)}>Első tétel felvétele ＋</button>
          </div>
        ) : (
          <>
            <label className="fkx-search">
              <span aria-hidden="true"><ClayIcon name="i-polc" size={26} /></span>
              <input type="search" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Keress tétel, márka…" aria-label="Keresés a kamrában" />
              {query && (
                <button type="button" aria-label="Keresés törlése" onClick={() => setQuery('')}>×</button>
              )}
            </label>

            <div className="fkx-filters" role="group" aria-label="Kamra-szűrő" data-kalauz-anchor="kamra-tabs">
              {TYPE_FILTERS.map(t => (
                <button key={t.id} type="button" aria-pressed={typeFilter === t.id}
                  style={{ '--fkx': t.color } as React.CSSProperties}
                  onClick={() => setTypeFilter(t.id)}>
                  {t.icon && <span aria-hidden="true"><ClayIcon name={t.icon} size={16} /></span>}
                  {t.label}<b>{counts[t.id] ?? 0}</b>
                </button>
              ))}
              <button type="button" className="fkx-filter-more" onClick={() => setFilterOpen(true)}>
                Szűrők{categoryFilter.length > 0 && <b>{categoryFilter.length}</b>}
              </button>
            </div>

            {categoryFilter.length > 0 && (
              <div className="fkx-catpills">
                {categoryFilter.map(key => (
                  <button key={key} type="button"
                    onClick={() => setCategoryFilter(cs => cs.filter(c => c !== key))}>
                    <i aria-hidden="true" style={{ background: categoryMeta[key]?.color ?? 'var(--sage)' }} />
                    {categoryMeta[key]?.label ?? key}<b aria-hidden="true">×</b>
                  </button>
                ))}
              </div>
            )}

            {filtered.length > 0 ? (
              <div className="fkx-tile-grid">
                {filtered.map(it => (
                  <PantryTile key={it.id} item={it} onOpen={() => navigate(`/fuel/kamra/${it.id}`)} />
                ))}
              </div>
            ) : (
              <p className="fkx-nohit">Nincs egyező tétel.</p>
            )}

            {/* B13: az okosabb csere ott marad, ahol volt — determinisztikus heurisztika, nem AI. */}
            {suggestions.length > 0 && (
              <>
                <div className="fmx-section"><h2>Okosabb csere</h2></div>
                <div className="fkx-swaps">
                  {suggestions.map((sug, i) => <SuggestionCard key={`${sug.name}-${i}`} sug={sug} />)}
                </div>
              </>
            )}
          </>
        )}
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
      {catalogOpen && <CatalogSearchSheet onClose={() => setCatalogOpen(false)} />}
    </div>
  )
}
