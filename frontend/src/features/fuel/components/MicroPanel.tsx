// ============================================================
// Mezo · MicroPanel (rost & mikro dimenzió csempe-grafikája)
// Mozaik 2.0 (mezo-jcpt.1): the generic ProgressBar rows became the prototype's
// `.tgrow` cél-sávok, so the rost/mikro tile draws the same graphic language as the
// makró tile above it — name · sáv · érték, coloured by the nutrient's status.
// ============================================================
import type { MicroDimension } from '@/data/types'
import { STATUS_COLOR } from '@/data/nova'

export function MicroPanel({ dim }: { dim: MicroDimension }) {
  return (
    <div className="col mt-md">
      {dim.micros.map((m, i) => (
        <div key={i} className="sb-tgrow">
          <span className="nm" style={{ color: STATUS_COLOR[m.status] }}>{m.name}</span>
          <div className="sb-gbar">
            <i style={{ width: `${Math.min(100, m.pct)}%`, background: STATUS_COLOR[m.status] }} />
          </div>
          <span className="vl">{m.value}</span>
        </div>
      ))}
    </div>
  )
}
