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
// Üveg U2 (mezo-me75u.2, prototype `SH.kamrapick`): the gold 3D stack head; search and every
// row are FLAT cells inside the sheet (no glass in the glass sheet), the category hue an inset
// left edge, and ＋ a lit gold flat chip (✓ dimmed once added).
// ============================================================
import { useState } from 'react'
import { usePantry } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { ContentIcon } from '@/shared/ui/clay'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { usePickableIngredients, kindLabel, type PickableIngredient } from '@/data/fuel/pantryPickables'

function KindBadge({ ing }: { ing: PickableIngredient }) {
  return <span className="fkx-tagf">{kindLabel(ing.kind)}</span>
}

function PickerRow({ ing, added, onPick }: { ing: PickableIngredient; added: boolean; onPick: () => void }) {
  const { categoryMeta } = usePantry()
  const catColor = categoryMeta[ing.category ?? '']?.color ?? 'var(--text-secondary)'
  return (
    <div className="fkx-pick uv-flat" style={{ '--c': catColor } as React.CSSProperties}>
      <div className="fkx-pick-top">
        <div className="fkx-pick-copy">
          <span className="fkx-pick-name">
            <strong>{ing.name}</strong>
            <KindBadge ing={ing} />
            <SourceBadge source={ing.source} />
          </span>
          <small>{ing.brand}{ing.nova ? ` · NOVA ${ing.nova}` : ''}</small>
        </div>
        {added ? (
          <button disabled aria-label={ing.name + ' hozzáadva'} className="fkx-pick-add is-added">
            <Icon name="check" size={14} />
          </button>
        ) : (
          <button onClick={onPick} aria-label={ing.name + ' hozzáadása'} className="fkx-pick-add is-gold">
            <Icon name="plus" size={14} />
          </button>
        )}
      </div>
      <div className="fkx-pick-macros">
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
      (i.brand ?? '').toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <Sheet onClose={onClose} className="sheet-nested fkx-rsheet-host" labelledBy="ingredient-pick-title">
      {(close) => (
        <>
          <div className="fkx-rsheet-head">
            <ContentIcon name="t-stack" size={40} />
            <div className="col">
              <Eyebrow brand>Kamra · pick</Eyebrow>
              <div id="ingredient-pick-title" style={{ marginTop: 4 }}>
                <Display size="md">Válassz hozzávalót</Display>
              </div>
            </div>
            <button className="fkx-rsheet-x" aria-label="Bezárás" onClick={close}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="fkx-search-row">
            <div className="fkx-search-field">
              <ContentIcon name="t-stack" size={20} />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Keress a Kamrában…"
              />
            </div>
          </div>

          <div className="fkx-rsheet fkx-pick-list">
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
