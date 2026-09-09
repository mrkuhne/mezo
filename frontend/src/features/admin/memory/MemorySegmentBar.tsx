// The five-way sub-nav segment bar (Áttekintés · Felidézések · Gráf · Térkép · Rétegek) —
// `.am-segbar`/`.am-seg` (prototype.css §Admin memory explorer). Lives in the URL (`?view=`),
// never local state: a deep link from a run candidate to "this edge on Gráf" or "this point on
// Térkép" is the whole point of the views sharing one inspector (AdminMemoryPage.tsx).
//
// mezo-k5zy: added `overview` as the new default landing view, and renamed the `runs` view's
// LABEL from "Futások" to "Felidézések" (the verdict-sentence work makes "recall", not "run", the
// right product word) — the URL VALUE stays `runs` so every existing `?view=runs` deep link keeps
// working unchanged.
export const VIEWS = {
  overview: 'Áttekintés',
  runs: 'Felidézések',
  graph: 'Gráf',
  map: 'Térkép',
  layers: 'Rétegek',
} as const
export type ViewKey = keyof typeof VIEWS

export function MemorySegmentBar({ active, onSelect }: { active: ViewKey; onSelect: (v: ViewKey) => void }) {
  return (
    <div className="am-segbar" role="tablist">
      {(Object.keys(VIEWS) as ViewKey[]).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={active === v}
          className={`am-seg${active === v ? ' on' : ''}`}
          onClick={() => onSelect(v)}
        >
          {VIEWS[v]}
        </button>
      ))}
    </div>
  )
}
