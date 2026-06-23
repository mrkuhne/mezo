// ============================================================
// Mezo · IngredientPickerSheet (nested modal — Kamra pick)
// Opens ON TOP of the RecipeEditorView page to pick a pantry ingredient. Search
// filters the Kamra by name + brand; each PickerRow shows a category-accented
// card with name + source badge + brand/NOVA subline and a MacroCells strip
// (/100g, the design-mockup cell look). Tapping ＋ fires onPick(ing).
// docs/design/recipes-editor.html (right phone · `.prow` + `.macstrip`).
// ============================================================
import { useState } from 'react'
import type { Ingredient } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { MacroCells } from './components/MacroCells'

function PickerRow({ ing, onPick }: { ing: Ingredient; onPick: () => void }) {
  const { categoryMeta } = usePantry()
  const catColor = categoryMeta[ing.category]?.color ?? 'var(--text-secondary)'
  return (
    <div className="card notch-4" style={{ padding: '11px 12px', borderLeft: '2px solid ' + catColor }}>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{ing.name}</span>
            <SourceBadge source={ing.source} />
          </div>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {ing.brand}{ing.nova ? ` · NOVA ${ing.nova}` : ''}
          </span>
        </div>
        <button
          onClick={onPick}
          aria-label={ing.name + ' hozzáadása'}
          className="notch-4"
          style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(20,184,166,0.14)', color: 'var(--brand-glow)' }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div style={{ marginTop: 9 }}>
        <MacroCells macros={ing.macros} perLabel="/100g" />
      </div>
    </div>
  )
}

export function IngredientPickerSheet({
  onPick,
  onClose,
}: {
  onPick: (ing: Ingredient) => void
  onClose: () => void
}) {
  const { ingredients } = usePantry()
  const [query, setQuery] = useState('')

  const filtered = ingredients.filter(
    i =>
      !query ||
      i.name.toLowerCase().includes(query.toLowerCase()) ||
      i.brand.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <Sheet onClose={onClose} className="sheet-nested" labelledBy="ingredient-pick-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="col">
              <Eyebrow brand>Kamra · pick</Eyebrow>
              <div id="ingredient-pick-title" style={{ marginTop: 4 }}>
                <Display size="md">Válassz hozzávalót</Display>
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div
            className="row gap-sm"
            style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', alignItems: 'center' }}
          >
            <Icon name="search" size={12} color="var(--text-tertiary)" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Keress a Kamrában…"
              style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}
            />
          </div>

          <div className="col gap-sm" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {filtered.map(ing => (
              <PickerRow key={ing.id} ing={ing} onPick={() => onPick(ing)} />
            ))}
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
