// ============================================================
// Mezo · IngredientPickerSheet (nested modal)
// Opens ON TOP of NewRecipeSheet to pick a pantry ingredient. A search box
// filters the Kamra by name + brand; each PickerRow is a selectable card
// whose accent colour comes from its category, and tapping it fires
// onPick(ing). Close via the sheet's animated dismiss.
// Port: prototype/src/fuel-recipes.jsx IngredientPickerSheet + PickerRow
// (778–846).
//
// Adaptations vs prototype:
//  - Uses the shared <Sheet> (portal + drag-to-close + Escape) instead of
//    the bespoke .sheet-backdrop/.sheet markup. The prototype raised the
//    nested z-index inline (sheet 61, backdrop 60); here we pass
//    className="sheet-nested" and add CSS that lifts BOTH the nested sheet
//    and its sibling backdrop above the parent sheet (201/200) — see
//    src/styles/prototype.css.
//  - Ingredients come from usePantry().ingredients, not window.MezoData.
// ============================================================
import { useState } from 'react'
import type { Ingredient } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { MacroRow } from '@/components/ui/MacroRow'

function PickerRow({ ing, onPick }: { ing: Ingredient; onPick: () => void }) {
  const { categoryMeta } = usePantry()
  const catColor = categoryMeta[ing.category]?.color ?? 'var(--text-secondary)'
  return (
    <button
      onClick={onPick}
      className="card notch-4 row"
      style={{
        padding: '10px 12px',
        width: '100%',
        textAlign: 'left',
        alignItems: 'center',
        gap: 10,
        borderLeft: '2px solid ' + catColor,
      }}
    >
      <div className="col flex-1" style={{ minWidth: 0 }}>
        <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{ing.name}</span>
          <SourceBadge source={ing.source} />
        </div>
        <MacroRow macros={ing.macros} per={ing.per} />
      </div>
      <Icon name="plus" size={12} color="var(--brand-glow)" />
    </button>
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
          {/* Header */}
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
          >
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

          {/* Search */}
          <div
            className="row gap-sm"
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              alignItems: 'center',
            }}
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

          {/* Ingredient list */}
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
