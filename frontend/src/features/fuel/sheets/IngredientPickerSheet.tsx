// ============================================================
// Mezo · IngredientPickerSheet (nested modal — Kamra pick)
// Opens ON TOP of the RecipeEditorPage page to pick a recipe ingredient. The list
// is the unified pickable set (foods + supplement/stim/med stash — protein powder
// etc. belong in recipes too, mezo-3vu4); search filters by name + brand. Each row
// shows a category-accented card with name + kind badge + source badge + brand/NOVA
// subline and a MacroCells strip (/100g). Tapping ＋ fires onPick(ing) but does NOT
// close the sheet, so several items can be added in one open; a row already in the
// recipe (addedRefIds) shows a disabled "Hozzáadva" state instead.
// docs/design/recipes-editor.html (right phone · `.prow` + `.macstrip`).
// ============================================================
import { useState } from 'react'
import { usePantry } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { usePickableIngredients, kindLabel, type PickableIngredient } from '@/data/fuel/pantryPickables'

function KindBadge({ ing }: { ing: PickableIngredient }) {
  return (
    <span
      className="label-mono"
      style={{
        fontSize: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '2px 5px', color: 'var(--text-tertiary)',
        border: '1px solid var(--border-subtle)', background: 'var(--surface-2)',
      }}
    >
      {kindLabel(ing.kind)}
    </span>
  )
}

function PickerRow({ ing, added, onPick }: { ing: PickableIngredient; added: boolean; onPick: () => void }) {
  const { categoryMeta } = usePantry()
  const catColor = categoryMeta[ing.category]?.color ?? 'var(--text-secondary)'
  return (
    <div className="card" style={{ padding: '11px 12px', borderLeft: '2px solid ' + catColor }}>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{ing.name}</span>
            <KindBadge ing={ing} />
            <SourceBadge source={ing.source} />
          </div>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {ing.brand}{ing.nova ? ` · NOVA ${ing.nova}` : ''}
          </span>
        </div>
        {added ? (
          <button
            disabled
            aria-label={ing.name + ' hozzáadva'}
            className="rad-12"
            style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--coral)', opacity: 0.55, cursor: 'default' }}
          >
            <Icon name="check" size={14} />
          </button>
        ) : (
          <button
            onClick={onPick}
            aria-label={ing.name + ' hozzáadása'}
            className="rad-12"
            style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--sage) 14%, transparent)', color: 'var(--coral)' }}
          >
            <Icon name="plus" size={14} />
          </button>
        )}
      </div>
      <div style={{ marginTop: 9 }}>
        <MacroCells macros={ing.macros} perLabel={`/${ing.per}${ing.unit}`} />
      </div>
    </div>
  )
}

export function IngredientPickerSheet({
  onPick,
  onClose,
  addedRefIds = [],
}: {
  onPick: (ing: PickableIngredient) => void
  onClose: () => void
  addedRefIds?: string[]
}) {
  const pickables = usePickableIngredients()
  const added = new Set(addedRefIds)
  const [query, setQuery] = useState('')

  const filtered = pickables.filter(
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
              <PickerRow key={ing.id} ing={ing} added={added.has(ing.id)} onPick={() => onPick(ing)} />
            ))}
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
