// ============================================================
// Mezo · LastWeekStat — single column in the "Múlt hét" comparison
// block (label + big display value + optional mono unit).
// Ported from prototype train.jsx.
// ============================================================
import type { ReactNode } from 'react'

export function LastWeekStat({
  label,
  val,
  unit = '',
}: {
  label: string
  val: ReactNode
  unit?: string
}) {
  return (
    <div className="col" style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
        {label}
      </span>
      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
        }}
      >
        {val}
        {unit && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-tertiary)',
              marginLeft: 3,
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}
