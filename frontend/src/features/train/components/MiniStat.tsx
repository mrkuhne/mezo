// ============================================================
// Mezo · MiniStat — compact stat cell for the planner summary header.
// Ported from prototype meso-planner.jsx MiniStat.
// ============================================================
import type { ReactNode } from 'react'

export function MiniStat({ label, val, highlight = false }: { label: string; val: ReactNode; highlight?: boolean }) {
  return (
    <div className="col flex-1">
      <span className="label-mono" style={{ fontSize: 8 }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 18,
          fontWeight: 600,
          marginTop: 2,
          lineHeight: 1,
          color: highlight ? 'var(--coral)' : 'var(--text-primary)',
        }}
      >
        {val}
      </span>
    </div>
  )
}
