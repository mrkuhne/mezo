// ============================================================
// Mezo · CatalogSearchSheet (S4, mezo-qw37.4) — "Hozzáadás a közösből"
// Searches the SHARED pantry catalog (master seed + every user's definitions) and puts a hit on
// the caller's own shelf via usePantryActions().addFromCatalog (idempotent server-side). Rows
// already on the shelf (matched by catalogId) read "a polcon" instead of offering Polcra again.
// Üveg (mezo-me75u.2, uveg-fuel-tobbi.html `SH.catalog`): one gold glass sheet; the search, the
// kind chips and the hit rows are flat cells inside it, the active chip filled gold.
// ============================================================
import { useEffect, useState } from 'react'
import { usePantry, usePantryActions } from '@/data/hooks'
import type { PantryCatalogEntry, PantryItemKind } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { KamraSheetHead, KAMRA_SHEET_CLASS } from '@/features/fuel/sheets/KamraSheetHead'

const KIND_CHIPS: { id: PantryItemKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Mind' }, { id: 'food', label: 'Étel' }, { id: 'supplement', label: 'Supp' },
  { id: 'stim', label: 'Stim' }, { id: 'med', label: 'Gyógyszer' },
]

export function CatalogSearchSheet({ onClose }: { onClose: () => void }) {
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
          <KamraSheetHead icon="t-stack" eyebrow="Közös katalógus" title="Hozzáadás a közösből"
            titleId="catalog-search-title" onClose={close} />
          <div className="fkk-sh-search uv-flat">
            <span aria-hidden="true"><Icon3D name="t-stack" size={22} /></span>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Keresés név vagy márka szerint"
            />
          </div>
          <div className="fkk-sh-chips">
            {KIND_CHIPS.map(c => (
              <button key={c.id} type="button" className={kind === c.id ? 'is-on' : undefined}
                aria-pressed={kind === c.id} onClick={() => setKind(c.id)}>{c.label}</button>
            ))}
          </div>
          <div className="fkk-sh-rows">
            {hits.length === 0 && <span className="fkk-sh-none">Nincs találat a közös katalógusban.</span>}
            {hits.map(h => {
              const have = onShelf.has(h.id)
              return (
                <div key={h.id} className="fkk-sh-row">
                  <div className="fkk-sh-row-copy">
                    <strong>{h.name}</strong>
                    <div className="fkk-sh-row-meta">
                      <SourceBadge source={h.source} />
                      {h.brand && <span>{h.brand}</span>}
                      {h.kcal != null && <span>· {h.kcal} kcal/{h.per ?? 100}{h.unit ?? 'g'}</span>}
                      <span className="fkk-sh-author">{h.authorName ?? 'mezo'}</span>
                    </div>
                  </div>
                  {have
                    ? <span className="fkk-sh-have">a polcon</span>
                    : <button type="button" className="fkk-sh-add" disabled={busy === h.id} onClick={() => add(h)}><Icon name="plus" size={11} /> Polcra</button>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}
