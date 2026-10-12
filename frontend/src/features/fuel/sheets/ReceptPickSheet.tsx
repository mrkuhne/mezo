// ============================================================
// Mezo · ReceptPickSheet (unified log flow — mezo-d20.4.2)
// The Recept source's picker: a single-add nested sheet that CLOSES on pick (design 2.0 iterations §7 —
// Kamra multi-adds and stays open, Recept commits to servings and closes).
//
// Folyadék (mezo-n4wf5.5, prototype fuel.js `SH.receptpick`): the light sheet with its head, the search
// field with the „csillagos" pill beside it (they compose), and two-storey rows — name (+ the star),
// „N hozzávaló · adag", per-serving kcal and the add button on top, the three macro levels under them.
// ============================================================
import { useState } from 'react'
import type { Recipe } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { plural, useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { Icon3D } from '@/shared/ui/clay'
import { Empty, FoSheetHead, Pill, SearchField } from '@/shared/ui/folyadek'
import { ItemRow, M3 } from '@/features/fuel/components/folyadek'

const round = (n: number) => Math.round(n)
function perServing(r: Recipe) {
  const s = Math.max(1, r.servings)
  return { kcal: round(r.macros.kcal / s), p: round(r.macros.p / s), c: round(r.macros.c / s), f: round(r.macros.f / s) }
}

function ReceptRow({ r, onPick }: { r: Recipe; onPick: () => void }) {
  const M = useM()
  const L = M.fuelLog.pick
  const per = perServing(r)
  const n = r.ingredients.length
  return (
    <ItemRow icon="t-book"
      title={<>{r.name}{r.starred && <> <i className="fg-star" role="img" aria-label={L.starred}><Icon3D name="t-star" size={15} /></i></>}</>}
      sub={plural(n, { one: L.recipeRow.one(n), other: L.recipeRow.other(n) })}
      value={(
        <span className="fg-pk2">
          <span>{fmtGrouped(per.kcal)}<small>{L.perServing}</small></span>
          <button type="button" onClick={onPick} aria-label={L.add(r.name)} className="fx-add">+</button>
        </span>
      )}>
      <M3 p={per.p} c={per.c} f={per.f} />
    </ItemRow>
  )
}

export function ReceptPickSheet({ onPick, onClose }: { onPick: (r: Recipe) => void; onClose: () => void }) {
  const M = useM()
  const L = M.fuelLog.pick
  const { recipes } = useRecipes()
  const [query, setQuery] = useState('')
  const [onlyStar, setOnlyStar] = useState(false)
  const q = query.toLowerCase()
  const filtered = recipes.filter(r =>
    (!onlyStar || r.starred) && (!q || r.name.toLowerCase().includes(q)))

  return (
    <Sheet onClose={onClose} className="fo-sheet sheet-nested fg-pick" labelledBy="recept-pick-title">
      {(close) => (
        <>
          <FoSheetHead icon="t-book" title={L.recipeTitle} titleId="recept-pick-title" sub={L.recipeSub} onClose={close} />
          <div className="fg-srow">
            <SearchField value={query} onChange={setQuery} placeholder={L.recipeSearch} aria-label={L.recipeSearchAria} />
            <Pill on={onlyStar} icon="t-star" onClick={() => setOnlyStar(v => !v)}>{L.starred}</Pill>
          </div>
          {filtered.map(r => (
            <ReceptRow key={r.id} r={r} onPick={() => { onPick(r); close() }} />
          ))}
          {filtered.length === 0 && <Empty>{L.recipeNone}</Empty>}
        </>
      )}
    </Sheet>
  )
}
