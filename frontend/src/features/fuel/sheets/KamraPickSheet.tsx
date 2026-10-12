// ============================================================
// Mezo · KamraPickSheet (unified log flow — mezo-d20.4.2; re-faced in mezo-byo1)
// The Kamra source's picker: a multi-add nested sheet that STAYS OPEN so several pantry lines can be
// added in one open (design 2.0 iterations §7). Scoped to plain food pantry items.
//
// Folyadék (mezo-n4wf5.5, prototype fuel.js `SH.kamrapick`): the light sheet with its head, the search
// field, one pill per category actually on the shelf (+ Mind), and two-storey rows — name, brand · NOVA,
// kcal per basis and the add button on top, the three macro levels under them. Search and pills compose.
// ============================================================
import { useMemo, useState } from 'react'
import { usePantry } from '@/data/hooks'
import type { Ingredient } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { useM } from '@/shared/i18n'
import { fmtGrouped, fmtNum } from '@/shared/lib/format'
import { Empty, FoSheetHead, Pill, Pills, SearchField } from '@/shared/ui/folyadek'
import { ItemRow, M3 } from '@/features/fuel/components/folyadek'
import { pantryCategoryIcon, pantryCategoryLabel } from '@/features/fuel/logic/kamraItems'

const Check = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

function KamraRow({ ing, added, onPick }: { ing: Ingredient; added: boolean; onPick: () => void }) {
  const M = useM()
  const L = M.fuelLog.pick
  const nova = ing.nova === 1 || ing.nova === 2 || ing.nova === 3 || ing.nova === 4 ? ing.nova : null
  const sub = [ing.brand, nova != null ? M.fuelKozos.nova[`n${nova}`] : null].filter(Boolean).join(' · ')
  return (
    <ItemRow icon={pantryCategoryIcon(ing.category)} title={ing.name} sub={sub || undefined}
      value={(
        <span className="fg-pk2">
          <span>{ing.macros.kcal == null ? '—' : fmtGrouped(ing.macros.kcal)}<small>{L.perBasis(fmtNum(ing.per), ing.unit)}</small></span>
          {added
            ? <button type="button" disabled aria-label={L.added(ing.name)} className="fx-add on"><Check /></button>
            : <button type="button" onClick={onPick} aria-label={L.add(ing.name)} className="fx-add">+</button>}
        </span>
      )}>
      <M3 p={ing.macros.p} c={ing.macros.c} f={ing.macros.f} />
    </ItemRow>
  )
}

export function KamraPickSheet({
  onPick, onClose, addedRefIds = [],
}: { onPick: (ing: Ingredient) => void; onClose: () => void; addedRefIds?: string[] }) {
  const M = useM()
  const L = M.fuelLog.pick
  const { ingredients } = usePantry()
  const added = new Set(addedRefIds)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const q = query.toLowerCase()

  // Only categories actually on the shelf become pills — labelled in the app language (`pantryCategoryLabel`, the same
  // words as the Kamra's own filter); an unmapped category prints its raw key, so it still filters honestly.
  const cats = useMemo(
    () => [...new Set(ingredients.map(i => i.category))].filter((c): c is string => !!c),
    [ingredients],
  )
  const filtered = ingredients.filter(i =>
    (cat == null || i.category === cat)
    && (!q || i.name.toLowerCase().includes(q) || (i.brand ?? '').toLowerCase().includes(q)))

  return (
    <Sheet onClose={onClose} className="fo-sheet sheet-nested fg-pick" labelledBy="kamra-pick-title">
      {(close) => (
        <>
          <FoSheetHead icon="t-stack" title={L.pantryTitle} titleId="kamra-pick-title" sub={L.pantrySub} onClose={close} />
          <SearchField value={query} onChange={setQuery} placeholder={L.pantrySearch} aria-label={L.pantrySearchAria} />
          <Pills className="fg-cats" role="group" aria-label={L.catGroup}>
            <Pill on={cat == null} onClick={() => setCat(null)}>{L.all}</Pill>
            {cats.map(c => (
              <Pill key={c} on={cat === c} onClick={() => setCat(prev => (prev === c ? null : c))}>
                {pantryCategoryLabel(c) ?? c}
              </Pill>
            ))}
          </Pills>
          {filtered.map(ing => (
            <KamraRow key={ing.id} ing={ing} added={added.has(ing.id)} onPick={() => onPick(ing)} />
          ))}
          {filtered.length === 0 && <Empty>{L.pantryNone}</Empty>}
        </>
      )}
    </Sheet>
  )
}
