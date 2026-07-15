import type { ReactNode } from 'react'

export interface SkillRowVM {
  key: string
  icon: string
  name: string
  level: number
  progressPct: number
  xp: number
}

const clampPct = (v: number) => Math.min(100, Math.max(0, v))

/**
 * One skill band (LIFE / Atlétikus / Izom) as a full meter-row list — Growth page Skillek tab.
 * Re-skinned (Napiv, mezo-8141 Task 7): reuses the `.skl` row idiom introduced for
 * GrowthSummaryCard's top-3 preview (Task 4) verbatim — name + `.bar i` width driven by
 * `progressPct` + `.lv` level readout. Per-row cumulative XP is no longer rendered here
 * (the `.skl` vocabulary has no XP slot); the aggregate stays visible via each band's
 * header chip (e.g. "8 skill · 1 085 XP"). `xp` stays on `SkillRowVM` — callers still
 * compute it, only this list's markup stopped displaying it.
 */
export function SkillBandCard({ eyebrow, chip, rows, footer }: {
  eyebrow: string
  chip: string
  rows: SkillRowVM[]
  footer?: ReactNode
}) {
  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{eyebrow}</span>
        <span className="chip notch-4">{chip}</span>
      </div>
      <div>
        {rows.map((r) => {
          const pct = clampPct(r.progressPct)
          return (
            <div key={r.key} className="skl">
              <span className="k">
                <span aria-hidden="true">{r.icon} </span>
                <span>{r.name}</span>
              </span>
              <div className="bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="lv">Lv {r.level}</span>
            </div>
          )
        })}
      </div>
      {footer}
    </div>
  )
}
