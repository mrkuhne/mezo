// ============================================================
// Mezo · KamraPickSheet (unified log flow — mezo-d20.4.2; re-faced in mezo-byo1)
// The 🫙 Kamra source tile's picker: a multi-add nested modal that STAYS OPEN so several
// pantry lines can be added in one open (design 2.0 iterations §7). Scoped to plain food
// pantry items — the same set LogMealSheet's Kamra arm has always drawn from.
//
// mezo-byo1 face (prototype fuel-logolas.html #sh-kpick): a horizontal CATEGORY CHIP row
// under the search (Mind + one color-dotted chip per category actually present, labels/
// colors from usePantry().categoryMeta), and the rows wear the Kamra page's kind-wash
// card language — category-colored spine + faint wash, NOVA dot, a right-aligned kcal
// cell — instead of the flat white cards. Search and chip filters compose.
// ============================================================
import { useMemo, useState } from 'react'
import { usePantry } from '@/data/hooks'
import type { Ingredient } from '@/data/types'
import type { NovaGroup } from '@/data/nova'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { Icon3D } from '@/shared/ui/clay'
import { NovaDot } from '@/features/fuel/components/NovaDot'
import { MacroCells } from '@/features/fuel/components/MacroCells'

const FALLBACK_COLOR = 'var(--text-secondary)'

function KamraRow({ ing, added, onPick }: { ing: Ingredient; added: boolean; onPick: () => void }) {
  const { categoryMeta } = usePantry()
  const catColor = categoryMeta[ing.category ?? '']?.color ?? FALLBACK_COLOR
  const nova = (ing.nova != null && ing.nova >= 1 && ing.nova <= 4 ? ing.nova : null) as NovaGroup | null
  return (
    <div className="fkp-item" style={{ '--kc': catColor } as React.CSSProperties}>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <span className="fkp-name">{ing.name}</span>
          <span className="label-mono row gap-xs fkp-meta">
            {ing.brand && <span>{ing.brand}</span>}
            {nova != null && <NovaDot nova={nova} />}
          </span>
        </div>
        <span className="fkp-kcell">
          <b>{ing.macros.kcal ?? '—'}</b><small>kcal /{ing.per}{ing.unit}</small>
        </span>
        {added ? (
          <button disabled aria-label={ing.name + ' hozzáadva'} className="fkp-add is-added">
            <Icon name="check" size={14} />
          </button>
        ) : (
          <button onClick={onPick} aria-label={ing.name + ' hozzáadása'} className="fkp-add">
            <Icon name="plus" size={14} />
          </button>
        )}
      </div>
      <div style={{ marginTop: 8 }}><MacroCells macros={ing.macros} perLabel={`/${ing.per}${ing.unit}`} /></div>
    </div>
  )
}

export function KamraPickSheet({
  onPick, onClose, addedRefIds = [],
}: { onPick: (ing: Ingredient) => void; onClose: () => void; addedRefIds?: string[] }) {
  const { ingredients, categoryMeta } = usePantry()
  const added = new Set(addedRefIds)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const q = query.toLowerCase()

  // Only categories actually on the shelf become chips — labeled/colored from categoryMeta,
  // falling back to the raw key so an unmapped category still filters honestly.
  const cats = useMemo(
    () => [...new Set(ingredients.map(i => i.category))].filter((c): c is string => !!c),
    [ingredients],
  )
  const filtered = ingredients.filter(i =>
    (cat == null || i.category === cat)
    && (!q || i.name.toLowerCase().includes(q) || (i.brand ?? '').toLowerCase().includes(q)))

  return (
    // Üveg (mezo-me75u.2, uveg-fuel-tobbi `SH.kamrapick`): a sheet `flp-kpick` hatókörében a
    // sorok LAPOS cellák a kategória-színű belső gerinccel, a fejléc a Kamra 3D ikonját viseli.
    <Sheet onClose={onClose} className="sheet-nested flp-kpick" labelledBy="kamra-pick-title">
      {(close) => (
        <>
          <div className="row flp-kpick-head">
            <Icon3D name="t-stack" size={48} />
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow brand>Kamra · hozzáadás</Eyebrow>
              <div id="kamra-pick-title" style={{ marginTop: 4 }}><Display size="md">Válassz a polcról</Display></div>
            </div>
            <button className="flp-x" aria-label="Bezárás" onClick={close}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="row gap-sm flp-search">
            <Icon name="search" size={14} color="var(--text-muted)" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Keress a Kamrában…" aria-label="Keresés a kamrában" />
          </div>

          <div className="fkp-chiprow" role="group" aria-label="Kategória-szűrő">
            <button type="button" className={'fkp-chip' + (cat == null ? ' is-on' : '')}
              style={{ '--cc': 'var(--text-secondary)' } as React.CSSProperties}
              aria-pressed={cat == null} onClick={() => setCat(null)}>
              Mind
            </button>
            {cats.map(c => (
              <button key={c} type="button" className={'fkp-chip' + (cat === c ? ' is-on' : '')}
                style={{ '--cc': categoryMeta[c]?.color ?? FALLBACK_COLOR } as React.CSSProperties}
                aria-pressed={cat === c} onClick={() => setCat(prev => (prev === c ? null : c))}>
                <span className="fkp-cdot" aria-hidden="true" />
                {categoryMeta[c]?.label ?? c}
              </button>
            ))}
          </div>

          <div className="col gap-sm" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filtered.map(ing => (
              <KamraRow key={ing.id} ing={ing} added={added.has(ing.id)} onPick={() => onPick(ing)} />
            ))}
            {filtered.length === 0 && (
              <p className="fkp-none uv-empty">
                Nincs találat ebben a kategóriában.
              </p>
            )}
          </div>
          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
