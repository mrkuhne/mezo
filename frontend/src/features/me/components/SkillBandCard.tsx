import type { ReactNode } from 'react'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'

export interface SkillRowVM {
  key: string
  icon: string
  name: string
  level: number
  progressPct: number
  xp: number
}

// Normalise hu-HU's NBSP / narrow-NBSP thousands separators to a plain space.
const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[\u00a0\u202f]/g, ' ')
const clampPct = (v: number) => Math.min(100, Math.max(0, v))

/** One skill band (LIFE / Atlétikus / Izom) as a full meter-row list — Growth page Skillek tab. */
export function SkillBandCard({ eyebrow, chip, rows, footer }: {
  eyebrow: string
  chip: string
  rows: SkillRowVM[]
  footer?: ReactNode
}) {
  const reduced = useReducedMotion()

  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-primary))' }} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
        <span className="eyebrow brand">{eyebrow}</span>
        <span className="chip notch-4">{chip}</span>
      </div>
      <div className="col gap-sm">
        {rows.map((r) => {
          const pct = clampPct(r.progressPct)
          return (
            <div key={r.key} className="progress-mrow">
              <span className="progress-mrk">{r.icon}</span>
              <span className="progress-mnm">{r.name}</span>
              <span className="progress-mlv">Lv {r.level}</span>
              <div className="progress-mbar">
                <div
                  className={`progress-mfill${reduced ? ' progress-mfill--reduced' : ''}`}
                  style={{ ['--w' as string]: `${pct}%`, ...(reduced ? { width: `${pct}%` } : {}) }}
                />
              </div>
              <span style={{ width: 46, textAlign: 'right', fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{fmt(r.xp)}</span>
            </div>
          )
        })}
      </div>
      {footer}
    </div>
  )
}
