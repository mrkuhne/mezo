// ============================================================
// Mezo · FuelKamraPage (Kamra) — a Konyha másik ajtaja mögötti polc
// (Fuel Titanium S4, mezo-hygp; fagyasztott manifeszt B6 · B7 · B13).
//
// Folyadék (F5, mezo-n4wf5.5) — build target: docs/design_2.0/prototypes/vilagos/fuel.js `kamra()`.
// Anatómia: hős (a polc fajtánként: négy üveg a darabszámmal, az ítélet-mondat, a három felvevő művelet)
// → 1 · Keresés és szűrés (kereső, fajta-szűrők a darabszámukkal, a kiválasztott kategóriák, a kategória-lap
// linkje) → 2 · A polcon (két-hasábos csempe-rács) → 3 · Okosabb csere (B13; szaggatott: javaslat, nem tárgy).
//
// A CSEMPE: ételnél a szint a FEHÉRJE-SŰRŰSÉG, 25 g / 100 g-nál tele — és CSAK akkor rajzolódik, ha a fehérje
// ismert (őszinte null: „—" / „nincs adat", sosem 0 — pantry.md §4). Kiegészítőnél a szám az adag, szint nincs.
//
// B14 owner-DROP: a „Legutóbbi importok" feed LEVÁLT erről a lapról; a per-tétel EREDET a tétel részletlapján él.
// B16 owner-DROP: a készlet/lejárat felület a `SHOW_PANTRY_STOCK` zászló mögött alszik; ez a lap nem szól róla.
//
// Változatlan viselkedés (csak az ARC változott): a `usePantry` adatút, a három tengelyen
// ANDolt szűrés (típus ÉS kategória ÉS keresés), a kategória-sheet darabszám szerint sorolt
// opciói, a valódi módú betöltő arc (mezo-f2z) és mind a négy felvevő-sheet.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PantryItem } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { useM } from '@/shared/i18n'
import { fmtGrouped, fmtNum } from '@/shared/lib/format'
import {
  Acts, Btn, Card, Empty, FrameBack, Hero, HeroGraphic, Lk, Note, Page, Pill, Pills, SearchField, Section, Stat, StatGrid, Vials,
  useFrameTitle, type VialItem,
} from '@/shared/ui/folyadek'
import { KAMRA_KINDS, KAMRA_KIND_ICON, buildKamraItems, kamraItemIcon, pantryCategoryLabel } from '@/features/fuel/logic/kamraItems'
import { SuggestionCard } from '@/features/fuel/components/SuggestionCard'
import { AddPantryItemSheet } from '@/features/fuel/sheets/AddPantryItemSheet'
import { ImportItemSheet } from '@/features/fuel/sheets/ImportItemSheet'
import { CatalogSearchSheet } from '@/features/fuel/sheets/CatalogSearchSheet'
import { CategoryFilterSheet, categoryOption } from '@/features/fuel/sheets/CategoryFilterSheet'
import { pantryProvenance } from '@/features/fuel/logic/pantryProvenance'
import KamraSkeleton from '@/features/fuel/pages/KamraSkeleton'

/** A csempe tele van ennyi g fehérjénél (100 grammban). */
const FULL_PROTEIN_G = 25

/** Az adag szövege úgy törik, ahogy a prototípusban: csak a „ + " után (a részeken belül nem törő szóköz). */
function DoseText({ dose }: { dose: string }) {
  const parts = dose.split(' + ')
  return (
    <em>
      {parts.map((p, i) => (
        <span key={i}>{p.replace(/ /g, ' ')}{i < parts.length - 1 && <>{' +'}<wbr /></>}</span>
      ))}
    </em>
  )
}

function PantryTile({ item, onOpen }: { item: PantryItem; onOpen: () => void }) {
  const M = useM()
  const K = M.fuelKamra
  const prov = pantryProvenance(item)
  const icon = kamraItemIcon(item)
  if (item.kind !== 'food') {
    return (
      <Stat label={item.name} icon={icon} color="var(--fx-water)" onClick={onOpen}
        value={item.dose ? <DoseText dose={item.dose} /> : <em>—</em>} unit={K.kamra.dose}
        note={[K.kind[item.kind] ?? null, item.brand, prov.kindLabel].filter(Boolean).join(' · ')} />
    )
  }
  const kcal = item.macros?.kcal ?? null
  const protein = item.macros?.p ?? null
  return (
    <Stat label={item.name} icon={icon} color="var(--fx-protein)" onClick={onOpen}
      value={kcal == null ? '—' : fmtGrouped(kcal)}
      unit={kcal == null ? undefined : K.kamra.kcalPer(item.per ?? 100, item.unit ?? 'g')}
      pct={protein == null ? null : Math.max(6, Math.min(100, (protein / FULL_PROTEIN_G) * 100))}
      note={[
        kcal == null ? M.fuelKozos.noData : protein == null ? null : K.kamra.proteinNote(fmtNum(protein)),
        item.brand, prov.kindLabel,
      ].filter(Boolean).join(' · ')} />
  )
}

export function FuelKamraPage() {
  const M = useM()
  const K = M.fuelKamra
  const navigate = useNavigate()
  const { ingredients, stash, suggestions, pending } = usePantry()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)

  const allItems = buildKamraItems(ingredients, stash)
  const total = allItems.length

  const counts: Record<string, number> = { all: total }
  allItems.forEach(it => { counts[it.kind] = (counts[it.kind] ?? 0) + 1 })
  const foods = counts.food ?? 0

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

  useFrameTitle({
    title: K.kamra.title,
    eyebrow: pending ? K.kamra.eyebrowLoading : total === 0 ? K.kamra.eyebrowEmpty : K.kamra.eyebrow(K.items(total)),
  })

  // Real-mode loading window — the loading face before the empty-state branch (hooks are
  // all above, so hook order stays stable). Mock mode never sets pending (mezo-f2z).
  if (pending) return <KamraSkeleton />

  const jars: VialItem[] = KAMRA_KINDS.map(k => ({
    label: K.kindCap[k], icon: KAMRA_KIND_ICON[k], pct: total ? ((counts[k] ?? 0) / total) * 100 : 0,
    value: String(counts[k] ?? 0), note: K.kamra.jarNote,
  }))
  const back = <FrameBack history fallback="/fuel/konyha" className="fo-backpill" label={K.back.kitchen}>‹ {K.kitchen}</FrameBack>
  const tools = (first: boolean) => (
    <>
      <Btn onClick={() => setAddOpen(true)}>{first ? K.kamra.addFirst : K.kamra.add}</Btn>
      <Btn sm ghost onClick={() => setImportOpen(true)}>{K.kamra.import}</Btn>
      <Lk onClick={() => setCatalogOpen(true)}>{K.kamra.catalogue}</Lk>
    </>
  )
  const sheets = (
    <>
      <AddPantryItemSheet open={addOpen} onClose={() => setAddOpen(false)} />
      {importOpen && <ImportItemSheet onClose={() => setImportOpen(false)} />}
      {catalogOpen && <CatalogSearchSheet onClose={() => setCatalogOpen(false)} />}
    </>
  )

  if (total === 0) {
    return (
      <Page className="fp-kamra">
        {back}
        <Hero className="fp-ghero" label={K.kamra.emptyLabel} verdict={K.kamra.emptyVerdict} sub={K.kamra.emptySub} actions={tools(true)}>
          <HeroGraphic aria-hidden="true"><Vials items={jars} height={84} /></HeroGraphic>
        </Hero>
        {sheets}
      </Page>
    )
  }

  return (
    <Page className="fp-kamra">
      {back}
      <Hero className="fp-ghero" label={K.kamra.heroLabel} verdict={K.kamra.verdict(total, foods, total - foods)} actions={tools(false)}>
        <HeroGraphic><Vials items={jars} height={84} /></HeroGraphic>
      </Hero>

      <Section n={1} title={K.kamra.searchSection} />
      <Card>
        <SearchField value={query} onChange={setQuery} placeholder={K.kamra.searchPlaceholder} aria-label={K.kamra.searchAria} />
        <Pills className="fp-kinds" role="group" aria-label={K.filterGroup} data-kalauz-anchor="kamra-tabs">
          <Pill on={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>{K.all}<b>{total}</b></Pill>
          {KAMRA_KINDS.map(k => (
            <Pill key={k} on={typeFilter === k} onClick={() => setTypeFilter(k)}>{K.kindCap[k]}<b>{counts[k] ?? 0}</b></Pill>
          ))}
        </Pills>
        {categoryFilter.length > 0 && (
          <div className="fp-cats">
            {categoryFilter.map(key => {
              const label = pantryCategoryLabel(key) ?? key
              return (
                <button key={key} type="button" aria-label={K.kamra.removeCat(label)}
                  onClick={() => setCategoryFilter(cs => cs.filter(c => c !== key))}>
                  {label}<b aria-hidden="true">×</b>
                </button>
              )
            })}
          </div>
        )}
        <Acts>
          <Lk onClick={() => setFilterOpen(true)}>
            {categoryFilter.length > 0 ? K.kamra.filtersOn(categoryFilter.length) : K.kamra.filters}
          </Lk>
        </Acts>
      </Card>

      <Section n={2} title={K.kamra.shelfSection} />
      <Card className="fp-shelf">
        {filtered.length > 0 ? (
          <>
            <StatGrid>
              {filtered.map(it => <PantryTile key={it.id} item={it} onOpen={() => navigate(`/fuel/kamra/${it.id}`)} />)}
            </StatGrid>
            <Note>{K.kamra.shelfNote}</Note>
          </>
        ) : (
          <Empty icon="t-lens">{K.kamra.noMatch}</Empty>
        )}
      </Card>

      {/* B13: az okosabb csere ott marad, ahol volt — determinisztikus heurisztika, nem AI. */}
      {suggestions.length > 0 && (
        <>
          <Section n={3} title={K.kamra.swapSection} />
          <Card>
            <div className="fp-swaps">
              {suggestions.map((sug, i) => <SuggestionCard key={`${sug.name}-${i}`} sug={sug} />)}
            </div>
            <Note>{K.kamra.swapNote}</Note>
          </Card>
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
      {sheets}
    </Page>
  )
}
