// ============================================================
// Mezo · KamraPickSheet (unified log flow — mezo-d20.4.2)
// The 🫙 Kamra source tile's picker: a multi-add nested modal that STAYS OPEN so several
// pantry lines can be added in one open (design 2.0 iterations §7). Mirrors
// IngredientPickerSheet's stays-open/✓-on-added idiom, scoped to plain food pantry items —
// the same set LogMealSheet's Kamra arm has always drawn from (usePantry, not the broader
// supplement/stim/med pickables the recipe editor reaches for).
// ============================================================
import { useState } from 'react'
import { usePantry } from '@/data/hooks'
import type { Ingredient } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { MacroCells } from '@/features/fuel/components/MacroCells'

function KamraRow({ ing, added, onPick }: { ing: Ingredient; added: boolean; onPick: () => void }) {
  const { categoryMeta } = usePantry()
  const catColor = categoryMeta[ing.category]?.color ?? 'var(--text-secondary)'
  return (
    <div className="card" style={{ padding: '11px 12px', borderLeft: '2px solid ' + catColor }}>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{ing.name}</span>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {ing.brand}{ing.nova ? ` · NOVA ${ing.nova}` : ''}
          </span>
        </div>
        {added ? (
          <button disabled aria-label={ing.name + ' hozzáadva'} className="rad-12"
            style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--mz-cell-gold-ink, var(--coral))', opacity: 0.55, cursor: 'default' }}>
            <Icon name="check" size={14} />
          </button>
        ) : (
          <button onClick={onPick} aria-label={ing.name + ' hozzáadása'} className="rad-12"
            style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--mz-tone-gold)', color: 'var(--mz-cell-gold-ink, #8A5E07)' }}>
            <Icon name="plus" size={14} />
          </button>
        )}
      </div>
      <div style={{ marginTop: 9 }}><MacroCells macros={ing.macros} perLabel={`/${ing.per}${ing.unit}`} /></div>
    </div>
  )
}

export function KamraPickSheet({
  onPick, onClose, addedRefIds = [],
}: { onPick: (ing: Ingredient) => void; onClose: () => void; addedRefIds?: string[] }) {
  const { ingredients } = usePantry()
  const added = new Set(addedRefIds)
  const [query, setQuery] = useState('')
  const q = query.toLowerCase()
  const filtered = ingredients.filter(i => !q || i.name.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q))

  return (
    <Sheet onClose={onClose} className="sheet-nested" labelledBy="kamra-pick-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="col">
              <Eyebrow brand>Kamra · hozzáadás</Eyebrow>
              <div id="kamra-pick-title" style={{ marginTop: 4 }}><Display size="md">Válassz a polcról</Display></div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="row gap-sm" style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', alignItems: 'center' }}>
            <Icon name="search" size={12} color="var(--text-tertiary)" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Keress a Kamrában…" aria-label="Keresés a kamrában"
              style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }} />
          </div>

          <div className="col gap-sm" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {filtered.map(ing => (
              <KamraRow key={ing.id} ing={ing} added={added.has(ing.id)} onPick={() => onPick(ing)} />
            ))}
          </div>
          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
