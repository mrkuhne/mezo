// The four-way sub-nav segment bar (Futások · Gráf · Térkép · Rétegek) — `.am-segbar`/`.am-seg`
// (prototype.css §Admin memory explorer). Lives in the URL (`?view=`), never local state: a
// deep link from a run candidate to "this edge on Gráf" or "this point on Térkép" is the whole
// point of the four views sharing one inspector (AdminMemoryPage.tsx).
export const VIEWS = { runs: 'Futások', graph: 'Gráf', map: 'Térkép', layers: 'Rétegek' } as const
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
