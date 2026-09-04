// ============================================================
// Mezo · CatalogSearchSheet (S4, mezo-qw37.4) — "Hozzáadás a közösből"
// Searches the SHARED pantry catalog (master seed + every user's definitions) and puts a hit on
// the caller's own shelf via usePantryActions().addFromCatalog (idempotent server-side). Rows
// already on the shelf (matched by catalogId) read "a polcon" instead of offering Polcra again.
// ============================================================
import { useEffect, useState } from 'react'
import { usePantry, usePantryActions } from '@/data/hooks'
import type { PantryCatalogEntry, PantryItemKind } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'

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
    <Sheet onClose={onClose} labelledBy="catalog-search-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div className="col">
              <Eyebrow brand>Közös katalógus</Eyebrow>
              <div id="catalog-search-title" style={{ marginTop: 4 }}><Display size="md">Hozzáadás a közösből</Display></div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Keresés név vagy márka szerint"
            style={{ fontSize: 14, width: '100%', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}
          />
          <div className="row gap-xs" style={{ margin: '10px 0' }}>
            {KIND_CHIPS.map(c => (
              <button key={c.id} type="button" className={`chip${kind === c.id ? ' brand' : ''}`} onClick={() => setKind(c.id)}>{c.label}</button>
            ))}
          </div>
          <div className="col gap-xs">
            {hits.length === 0 && <span className="text-tertiary" style={{ fontSize: 12, padding: 8 }}>Nincs találat a közös katalógusban.</span>}
            {hits.map(h => {
              const have = onShelf.has(h.id)
              return (
                <div key={h.id} className="card row" style={{ alignItems: 'center', gap: 10, padding: '8px 10px' }}>
                  <div className="col flex-1" style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                    <div className="row gap-xs" style={{ alignItems: 'center', fontSize: 10, color: 'var(--text-tertiary)' }}>
                      <SourceBadge source={h.source} />
                      {h.brand && <span>{h.brand}</span>}
                      {h.kcal != null && <span>· {h.kcal} kcal/{h.per ?? 100}{h.unit ?? 'g'}</span>}
                      <span className="chip" style={{ fontSize: 8, padding: '1px 5px' }}>{h.authorName ?? 'mezo'}</span>
                    </div>
                  </div>
                  {have
                    ? <span className="text-tertiary" style={{ fontSize: 11 }}>a polcon</span>
                    : <button type="button" className="chip brand" disabled={busy === h.id} onClick={() => add(h)}><Icon name="plus" size={11} /> Polcra</button>}
                </div>
              )
            })}
          </div>
          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
