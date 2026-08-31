import type { ReactNode } from 'react'
import { clampPct } from '@/shared/lib/pct'
import { cn } from '@/shared/lib/cn'

export interface SkillRowVM {
  key: string
  icon: ReactNode
  name: string
  level: number
  progressPct: number
  xp: number
}

export type SkillBandWash = 'lav' | 'sage' | 'amber'

// Normalise hu-HU's NBSP / narrow-NBSP thousands separators to a plain space.
const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

/**
 * One skill band (LIFE / Atlétikus / Izom) as a full meter-row list — Growth page Skillek tab.
 * Mozaik reface (mezo-d20.6.5): the card itself wears the prototype's washed `.predtile`
 * skin (`gr-band`, one tint per band); per-skill rows keep the shared `.skl` row idiom
 * introduced for GrowthSummaryCard's top-3 preview (Task 4) verbatim — name + `.bar i`
 * width driven by `progressPct` (already self-animating, prefers-reduced-motion guarded)
 * + `.lv` level readout — plus one SkillBandCard-local extension: a right-aligned per-row
 * cumulative-XP readout after `.lv` ("no functionality lost" rule; the shared
 * `.skl`/`.bar`/`.lv` classes are untouched, so GrowthSummaryCard's top-3 preview on
 * Profil keeps its original three-slot shape).
 */
export function SkillBandCard({ eyebrow, chip, rows, footer, wash = 'lav', delayMs }: {
  eyebrow: string
  chip: string
  rows: SkillRowVM[]
  footer?: ReactNode
  wash?: SkillBandWash
  /** entrance stagger — the prototype's `.predtile.rise` `--d` on the Skillek tab
   *  (mezo-d20.11); the `.mz-play` wrapper is the page's job. */
  delayMs?: number
}) {
  return (
    <div className={cn('gr-band', wash, 'rise')}
      style={delayMs !== undefined ? ({ '--d': `${delayMs}ms` } as React.CSSProperties) : undefined}>
      <div className="gr-band-top">
        <span className="mz-eyebrow">{eyebrow}</span>
        <span className="gr-band-chip">{chip}</span>
      </div>
      <div>
        {rows.map((r, i) => {
          const pct = clampPct(r.progressPct)
          return (
            <div key={r.key} className="skl" style={{ '--d': `${350 + i * 60}ms` } as React.CSSProperties}>
              <span className="k">
                <span aria-hidden="true" style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: 4 }}>{r.icon}</span>
                <span>{r.name}</span>
              </span>
              <div className="bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="lv">Lv {r.level}</span>
              <span style={{ width: 44, textAlign: 'right', fontSize: 10, fontWeight: 700, color: 'var(--mz-ink-mut)', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.xp)}</span>
            </div>
          )
        })}
      </div>
      {footer && <div className="gr-band-foot">{footer}</div>}
    </div>
  )
}
