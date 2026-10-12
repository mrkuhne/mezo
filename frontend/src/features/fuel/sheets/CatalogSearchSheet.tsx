// ============================================================
// Mezo · CatalogSearchSheet (S4, mezo-qw37.4) — "Hozzáadás a közösből"
// Searches the SHARED pantry catalog (master seed + every user's definitions) and puts a hit on
// the caller's own shelf via usePantryActions().addFromCatalog (idempotent server-side). Rows
// already on the shelf (matched by catalogId) read "a polcon" instead of offering Polcra again.
// Folyadék (F5, mezo-n4wf5.5; prototype `fuel.js` `sheetsC.catalog`): the light sheet + `FoSheetHead`, the kit search
// field, the kind pills, and one kit row per hit (the item's glyph · name · brand and kcal · „felvette: <szerző>" on its
// own line · the quiet „a polcon" pill or the small „+ Polcra" button). „Bezárom" closes it.
// ============================================================
import { useEffect, useState } from 'react'
import { usePantry, usePantryActions } from '@/data/hooks'
import type { PantryCatalogEntry, PantryItemKind } from '@/data/types'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, Empty, Lk, Pill, Pills, Row, SearchField, St } from '@/shared/ui/folyadek'
import { KAMRA_KINDS, kamraItemIcon } from '@/features/fuel/logic/kamraItems'
import { KamraSheetHead, KAMRA_SHEET_CLASS } from '@/features/fuel/sheets/KamraSheetHead'

export function CatalogSearchSheet({ onClose }: { onClose: () => void }) {
  const M = useM()
  const C = M.fuelKamra.catalog
  const { ingredients, stash } = usePantry()
  const { searchCatalog, addFromCatalog } = usePantryActions()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<PantryItemKind | 'all'>('all')
  const [hits, setHits] = useState<PantryCatalogEntry[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const onShelf = new Set([...ingredients, ...stash].map(i => i.catalogId).filter(Boolean))

  // Debounced search; every keystroke/chip change supersedes the previous request.
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      searchCatalog(q, kind === 'all' ? undefined : kind).then(r => { if (alive) setHits(r) }).catch(() => { if (alive) setHits([]) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q, kind, searchCatalog])

  async function add(entry: PantryCatalogEntry) {
    setBusy(entry.id)
    try { await addFromCatalog(entry.id) } finally { setBusy(null) }
  }

  return (
    <Sheet onClose={onClose} labelledBy="catalog-search-title" className={KAMRA_SHEET_CLASS}>
      {(close) => (
        <>
          <KamraSheetHead icon="t-stack" eyebrow={C.sub} title={C.title} titleId="catalog-search-title" />
          <SearchField value={q} onChange={setQ} placeholder={C.search} />
          <Pills className="fp-kinds" role="group" aria-label={M.fuelKamra.filterGroup}>
            <Pill on={kind === 'all'} onClick={() => setKind('all')}>{M.fuelKamra.all}</Pill>
            {KAMRA_KINDS.map(k => <Pill key={k} on={kind === k} onClick={() => setKind(k)}>{M.fuelKamra.kindCap[k]}</Pill>)}
          </Pills>
          {hits.length === 0 && <Empty icon="t-stack">{C.none}</Empty>}
          {hits.map(h => {
            const have = onShelf.has(h.id)
            const facts = [h.brand, h.kcal != null ? C.kcal(fmtGrouped(h.kcal), h.per ?? 100, h.unit ?? 'g') : null].filter(Boolean).join(' · ')
            return (
              <Row key={h.id} className="fp-hit" icon={kamraItemIcon(h)} title={h.name}
                sub={<>{facts !== '' && <>{facts}<br /></>}{C.addedBy(h.authorName ?? 'Mezo')}</>}
                right={have
                  ? <St>{C.onShelf}</St>
                  : <Btn sm ghost disabled={busy === h.id} onClick={() => add(h)}>{C.add}</Btn>} />
            )
          })}
          <Acts><Lk onClick={close}>{C.close}</Lk></Acts>
        </>
      )}
    </Sheet>
  )
}
