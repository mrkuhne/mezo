// ============================================================
// Mezo · ReceptPickSheet (unified log flow — mezo-d20.4.2)
// The 🥄 Recept source tile's picker: a single-add nested modal that CLOSES on pick (design
// 2.0 iterations §7 — Kamra multi-adds and stays open, Recept commits to servings and closes).
// Mirrors MealPickerSheet's recipe-tab rows, split into its own sheet since the two sources are
// now separate tiles rather than tabs of one picker.
//
// mezo-byo1 face (prototype fuel-logolas.html #sh-rpick): a `★ csillagos` filter chip under
// the search (composes with the query), and the rows wear the coral kind-wash card language
// (spine + faint wash, ★ on starred names, right-aligned per-serving kcal cell).
// Üveg U2 (mezo-me75u.2, prototype `SH.receptpick`): the sheet carries the coral 3D book head;
// search, the csillagos chip (3D star, no ★ literal) and every row are FLAT cells inside the
// sheet, a row's coral spine an inset edge; the per-serving kcal a quiet right cell.
// ============================================================
import { useState } from 'react'
import type { Recipe } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { ContentIcon } from '@/shared/ui/clay'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { MacroCells } from '@/features/fuel/components/MacroCells'

const round = (n: number) => Math.round(n)
function perServing(r: Recipe) {
  const s = Math.max(1, r.servings)
  return { kcal: round(r.macros.kcal / s), p: round(r.macros.p / s), c: round(r.macros.c / s), f: round(r.macros.f / s) }
}

function ReceptRow({ r, onPick }: { r: Recipe; onPick: () => void }) {
  const per = perServing(r)
  return (
    <div className="fkx-pick uv-flat" style={{ '--c': 'var(--dv-coral)' } as React.CSSProperties}>
      <div className="fkx-pick-top">
        <div className="fkx-pick-copy">
          <span className="fkx-pick-name">
            <strong>{r.name}</strong>
            {r.starred && (
              <span role="img" aria-label="csillagos" className="fkx-pick-star"><ContentIcon name="t-star" size={15} /></span>
            )}
            {r.slot && <span className="fkx-tagf">{r.slot}</span>}
          </span>
          <small>{r.ingredients.length} hozzávaló · adag</small>
        </div>
        <span className="fkx-pick-kcal">
          <b>{per.kcal}</b><small>kcal /adag</small>
        </span>
        <button type="button" onClick={onPick} aria-label={r.name + ' hozzáadása'} className="fkx-pick-add">
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="fkx-pick-macros"><MacroCells macros={per} perLabel="/adag" /></div>
    </div>
  )
}

export function ReceptPickSheet({ onPick, onClose }: { onPick: (r: Recipe) => void; onClose: () => void }) {
  const { recipes } = useRecipes()
  const [query, setQuery] = useState('')
  const [onlyStar, setOnlyStar] = useState(false)
  const q = query.toLowerCase()
  const filtered = recipes.filter(r =>
    (!onlyStar || r.starred) && (!q || r.name.toLowerCase().includes(q)))

  return (
    <Sheet onClose={onClose} className="sheet-nested fkx-rsheet-host" labelledBy="recept-pick-title">
      {(close) => (
        <>
          <div className="fkx-rsheet-head">
            <ContentIcon name="t-book" size={40} />
            <div className="col">
              <Eyebrow brand>Recept · hozzáadás</Eyebrow>
              <div id="recept-pick-title" style={{ marginTop: 4 }}><Display size="md">Válassz receptet</Display></div>
            </div>
            <button className="fkx-rsheet-x" aria-label="Bezárás" onClick={close}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="fkx-search-row">
            <div className="fkx-search-field">
              <ContentIcon name="t-book" size={20} />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Keress receptet…" aria-label="Keresés a receptek között" />
            </div>
            <button type="button" className={'fkx-chip is-star' + (onlyStar ? ' is-on' : '')}
              aria-pressed={onlyStar} onClick={() => setOnlyStar(v => !v)}>
              <ContentIcon name="t-star" size={18} />csillagos
            </button>
          </div>

          <div className="fkx-rsheet fkx-pick-list">
            {filtered.map(r => (
              <ReceptRow key={r.id} r={r} onPick={() => { onPick(r); close() }} />
            ))}
            {filtered.length === 0 && (
              <p className="fkx-pick-none uv-empty">
                Nincs ilyen recept.
              </p>
            )}
          </div>
          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
