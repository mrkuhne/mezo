import type { ReactNode } from 'react'
import { clampPct } from '@/shared/lib/pct'

export interface SkillRowVM {
  key: string
  icon: string
  name: string
  level: number
  progressPct: number
  xp: number
}

// Normalise hu-HU's NBSP / narrow-NBSP thousands separators to a plain space.
const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

/**
 * One skill band (LIFE / Atlétikus / Izom) as a full meter-row list — Growth page Skillek tab.
 * Re-skinned (Napiv, mezo-8141 Task 7): reuses the `.skl` row idiom introduced for
 * GrowthSummaryCard's top-3 preview (Task 4) — name + `.bar i` width driven by
 * `progressPct` + `.lv` level readout — plus one SkillBandCard-local extension: a
 * right-aligned per-row cumulative-XP readout after `.lv` ("no functionality lost" rule;
 * the shared `.skl`/`.bar`/`.lv` classes are untouched, so GrowthSummaryCard's top-3
 * preview on Profil keeps its original three-slot shape).
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
              <span style={{ width: 44, textAlign: 'right', fontSize: 10, fontWeight: 700, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.xp)}</span>
            </div>
          )
        })}
      </div>
      {footer}
    </div>
  )
}
