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
// ============================================================
import { useState } from 'react'
import type { Recipe } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
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
    <div className="fkp-item" style={{ '--kc': 'var(--coral)' } as React.CSSProperties}>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
            {r.starred && <span aria-label="csillagos" style={{ fontSize: 11, color: 'var(--mz-cell-gold-ink, #A8801F)' }}>★</span>}
            {r.slot && <span className="chip brand" style={{ fontSize: 8, padding: '2px 6px' }}>{r.slot}</span>}
          </div>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {r.ingredients.length} hozzávaló · adag
          </span>
        </div>
        <span className="fkp-kcell">
          <b>{per.kcal}</b><small>kcal /adag</small>
        </span>
        <button onClick={onPick} aria-label={r.name + ' hozzáadása'} className="rad-12"
          style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--coral) 14%, transparent)', color: 'var(--coral)' }}>
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div style={{ marginTop: 8 }}><MacroCells macros={per} perLabel="/adag" /></div>
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
    <Sheet onClose={onClose} className="sheet-nested" labelledBy="recept-pick-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="col">
              <Eyebrow brand>Recept · hozzáadás</Eyebrow>
              <div id="recept-pick-title" style={{ marginTop: 4 }}><Display size="md">Válassz receptet</Display></div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="row gap-sm" style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', alignItems: 'center' }}>
            <Icon name="search" size={12} color="var(--text-tertiary)" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Keress receptet…" aria-label="Keresés a receptek között"
              style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }} />
          </div>

          <div className="fkp-chiprow">
            <button type="button" className={'fkp-chip' + (onlyStar ? ' is-on' : '')}
              style={{ '--cc': 'var(--mz-cell-gold-ink, #A8801F)' } as React.CSSProperties}
              aria-pressed={onlyStar} onClick={() => setOnlyStar(v => !v)}>
              ★ csillagos
            </button>
          </div>

          <div className="col gap-sm" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filtered.map(r => (
              <ReceptRow key={r.id} r={r} onPick={() => { onPick(r); close() }} />
            ))}
            {filtered.length === 0 && (
              <p className="text-tertiary" style={{ fontSize: 11, textAlign: 'center', padding: '20px 8px' }}>
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
