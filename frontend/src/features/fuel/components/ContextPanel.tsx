// ============================================================
// Mezo · ContextPanel (időzítés & kontextus + a generikus sor-dimenziók grafikája)
// Mozaik 2.0 (mezo-jcpt.1): the label/value rows became the prototype's `.hlch`
// tény-chipek — the same chip row the Heti elemzés card wears, so a dimension's facts
// read as objects on the tile instead of a table inside it.
// ============================================================
import type { ContextDimension, RowsDimension } from '@/data/types'

export function ContextPanel({ dim }: { dim: ContextDimension | RowsDimension }) {
  return (
    <div className="sb-fchips">
      {dim.context.map((c, i) => (
        <span key={i} className="sb-fchip">
          <em>{c.label}</em>
          <span>{c.value}</span>
        </span>
      ))}
    </div>
  )
}
