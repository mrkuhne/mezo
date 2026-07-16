// ============================================================
// Mezo · MealPickerSheet (2-tab Receptek/Kamra — nested modal)
// Opens OVER LogMealSheet to add a meal item. Tabs: Receptek (recipe rows: name +
// slot + per-serving macros) / Kamra (pantry rows: name + macros /100g). One
// search across the active tab; tapping ＋ emits a MealPickedItem (recipe → 1 adag,
// pantry → per g). Mirrors IngredientPickerSheet (.prow rows + MacroCells).
// docs/design/meal-logging-sheet.html (right phone · .ptabs + .prow).
// ============================================================
import { useState } from 'react'
import type { Ingredient, Recipe } from '@/data/types'
import { useRecipes, usePantry } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { MacroCells } from '@/features/fuel/components/MacroCells'

export interface MealPickedItem {
  source: 'recipe' | 'pantry'
  refId: string // recipeId (source 'recipe') or pantryItemId (source 'pantry') — canonical MealInputItem
  amount: number
  unit: string
}

type Tab = 'recipes' | 'pantry'

const round = (n: number) => Math.round(n)
function perServing(r: Recipe) {
  const s = Math.max(1, r.servings)
  return { kcal: round(r.macros.kcal / s), p: round(r.macros.p / s), c: round(r.macros.c / s), f: round(r.macros.f / s) }
}

function RecipeRow({ r, onPick }: { r: Recipe; onPick: () => void }) {
  return (
    <div className="card" style={{ padding: '11px 12px', borderLeft: '2px solid var(--brand-glow)' }}>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{r.name}</span>
            {r.slot && <span className="chip brand" style={{ fontSize: 8, padding: '2px 6px' }}>{r.slot}</span>}
          </div>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {r.ingredients.length} hozzávaló · adag
          </span>
        </div>
        <button onClick={onPick} aria-label={r.name + ' hozzáadása'} className="rad-12"
          style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--sage) 14%, transparent)', color: 'var(--brand-glow)' }}>
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div style={{ marginTop: 9 }}><MacroCells macros={perServing(r)} perLabel="/adag" /></div>
    </div>
  )
}

function PantryRow({ ing, onPick }: { ing: Ingredient; onPick: () => void }) {
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
        <button onClick={onPick} aria-label={ing.name + ' hozzáadása'} className="rad-12"
          style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--sage) 14%, transparent)', color: 'var(--brand-glow)' }}>
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div style={{ marginTop: 9 }}><MacroCells macros={ing.macros} perLabel="/100g" /></div>
    </div>
  )
}

export function MealPickerSheet({ onPick, onClose }: { onPick: (item: MealPickedItem) => void; onClose: () => void }) {
  const { recipes } = useRecipes()
  const { ingredients } = usePantry()
  const [tab, setTab] = useState<Tab>('recipes')
  const [query, setQuery] = useState('')

  const q = query.toLowerCase()
  const filteredRecipes = recipes.filter(r => !q || r.name.toLowerCase().includes(q))
  const filteredPantry = ingredients.filter(i => !q || i.name.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q))

  return (
    <Sheet onClose={onClose} className="sheet-nested" labelledBy="meal-pick-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="col">
              <Eyebrow brand>Hozzáadás az étkezéshez</Eyebrow>
              <div id="meal-pick-title" style={{ marginTop: 4 }}><Display size="md">Receptből / Kamrából</Display></div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="row gap-xs" style={{ marginBottom: 12 }}>
            <button onClick={() => setTab('recipes')} className={'chip flex-1' + (tab === 'recipes' ? ' brand' : '')}
              style={{ justifyContent: 'center', padding: '9px 0', fontSize: 11 }} aria-pressed={tab === 'recipes'}>Receptek</button>
            <button onClick={() => setTab('pantry')} className={'chip flex-1' + (tab === 'pantry' ? ' brand' : '')}
              style={{ justifyContent: 'center', padding: '9px 0', fontSize: 11 }} aria-pressed={tab === 'pantry'}>Kamra</button>
          </div>

          <div className="row gap-sm" style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', alignItems: 'center' }}>
            <Icon name="search" size={12} color="var(--text-tertiary)" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Keress recept vagy alapanyag…" aria-label="Keresés"
              style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }} />
          </div>

          <div className="col gap-sm" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {tab === 'recipes'
              ? filteredRecipes.map(r => (
                  <RecipeRow key={r.id} r={r} onPick={() => onPick({ source: 'recipe', refId: r.id, amount: 1, unit: 'adag' })} />
                ))
              : filteredPantry.map(ing => (
                  <PantryRow key={ing.id} ing={ing} onPick={() => onPick({ source: 'pantry', refId: ing.id, amount: ing.per || 100, unit: ing.unit || 'g' })} />
                ))}
          </div>
          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
