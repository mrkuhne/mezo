// ============================================================
// Mezo · MicroPanel (micro–macro balance dimension)
// Per-micronutrient bar coloured by status (good/ok/low)
// ============================================================
import type { MicroDimension } from '@/data/types'
import { ProgressBar } from '@/shared/ui/ProgressBar'
import { STATUS_COLOR } from '@/data/nova'

export function MicroPanel({ dim }: { dim: MicroDimension }) {
  return (
    <div className="col gap-sm mt-md">
      {dim.micros.map((m, i) => (
        <div key={i} className="row gap-sm" style={{ alignItems: 'center' }}>
          <span className="label-mono" style={{
            width: 88, fontSize: 10,
            color: STATUS_COLOR[m.status],
          }}>{m.name}</span>
          <ProgressBar
            className="flex-1"
            value={Math.min(100, m.pct)}
            color={STATUS_COLOR[m.status]}
            glow={m.status === 'good'}
          />
          <span style={{
            fontVariantNumeric: 'tabular-nums', fontSize: 10,
            width: 56, textAlign: 'right',
            color: 'var(--text-secondary)',
          }}>{m.value}</span>
        </div>
      ))}
    </div>
  )
}
