// ============================================================
// Mezo · IngredientPickerSheet (nested modal — Kamra pick)
// Opens ON TOP of the recipe editor / the Műhely to pick a pantry item. The list is the unified
// pickable set (foods + supplement/stim/med stash — protein powder etc. belong in recipes too,
// mezo-3vu4); search filters by name + brand. Tapping ＋ fires onPick(ing) but does NOT close the
// sheet, so several items can be added in one open; a row already in the recipe (addedRefIds)
// shows a disabled „hozzáadva" tick instead. (The Műhely's swap closes it itself, in `onPick`.)
// Folyadék (mezo-n4wf5.5, fuel.js `SH.ingpick`): the light sheet — `FoSheetHead`, the kit search
// field, a two-storey row per item (tags under the name, kcal per basis + the add button on the
// right, the three macro levels below). `mode` only picks the head's context line and the note.
// ============================================================
import { useState } from 'react'
import { useM } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, FoSheetHead, Lk, Note, SearchField } from '@/shared/ui/folyadek'
import { ItemRow, LineTags, M3 } from '@/features/fuel/components/folyadek'
import { pantrySourceLabel } from '@/features/fuel/logic/pantryProvenance'
import { ingredientStyle } from '@/features/fuel/components/FuelQualityBlocks'
import { usePickableIngredients, type PickableIngredient } from '@/data/fuel/pantryPickables'

export type IngredientPickerMode = 'add' | 'round' | 'swap'

function PickerRow({ ing, added, onPick }: { ing: PickableIngredient; added: boolean; onPick: () => void }) {
  const M = useM()
  const P = M.fuelRecept.picker
  const kind = ing.kind === 'food' ? null : M.fuelRecept.common.kind[ing.kind]
  const detail = [ing.brand, ing.nova ? `NOVA ${ing.nova}` : null].filter(Boolean).join(' · ')
  return (
    <ItemRow
      icon={ingredientStyle(ing.name).icon}
      title={ing.name}
      sub={<LineTags extra={[kind, pantrySourceLabel(ing.source), detail]} />}
      value={(
        <span className="fc-pk">
          <span>{ing.macros.kcal ?? '—'}<small>{P.per(ing.per, ing.unit)}</small></span>
          {added ? (
            <button type="button" disabled aria-label={P.added(ing.name)} className="fx-add on">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </button>
          ) : (
            <button type="button" onClick={onPick} aria-label={P.add(ing.name)} className="fx-add">+</button>
          )}
        </span>
      )}
    >
      <M3 p={ing.macros.p ?? null} c={ing.macros.c ?? null} f={ing.macros.f ?? null} />
    </ItemRow>
  )
}

export function IngredientPickerSheet({
  onPick,
  onClose,
  addedRefIds = [],
  mode = 'add',
}: {
  onPick: (ing: PickableIngredient) => void
  onClose: () => void
  addedRefIds?: string[]
  /** Which face the head and the note wear: adding lines (default), marking items for the Műhely's
   *  next round, or swapping an estimated line. Behaviour is the caller's (`onPick`). */
  mode?: IngredientPickerMode
}) {
  const M = useM()
  const P = M.fuelRecept.picker
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
    <Sheet onClose={onClose} className="fo-sheet sheet-nested fc-pick" labelledBy="ingredient-pick-title">
      {(close) => (
        <>
          <FoSheetHead icon="t-stack" title={P.title} titleId="ingredient-pick-title" onClose={close}
            sub={mode === 'swap' ? P.subSwap : mode === 'round' ? P.subRound : P.subAdd} />
          <SearchField value={query} onChange={setQuery} placeholder={P.search} />
          <div className="fc-pick-list">
            {filtered.map(ing => (
              <PickerRow key={ing.id} ing={ing} added={added.has(ing.id)} onPick={() => onPick(ing)} />
            ))}
          </div>
          <Note>{mode === 'swap' ? P.noteSwap : P.noteMulti}</Note>
          <Acts><Lk onClick={close}>{P.done}</Lk></Acts>
        </>
      )}
    </Sheet>
  )
}
