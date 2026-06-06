// ============================================================
// Mezo · PhaseDots — one dot per phaseCurve entry, coloured via
// MESOCYCLE_PHASE_COLORS. The current week's dot is enlarged + glowing;
// dots past the current week are dimmed to surface-3.
// Ported from prototype train-views.jsx PhaseDots.
// ============================================================
import { MESOCYCLE_PHASE_COLORS } from '@/data/train'
import type { MesoPhase } from '@/data/types'

interface PhaseDotsProps {
  phases: MesoPhase[]
  // Zero-based index of the current week within phaseCurve.
  current: number
}

export function PhaseDots({ phases, current }: PhaseDotsProps) {
  return (
    <div className="row gap-xs" style={{ alignItems: 'center' }}>
      {phases.map((p, i) => {
        const color = MESOCYCLE_PHASE_COLORS[p]
        const isCurrent = i === current
        return (
          <span
            key={i}
            title={p}
            style={{
              width: isCurrent ? 8 : 5,
              height: isCurrent ? 8 : 5,
              borderRadius: '50%',
              background: i <= current ? color : 'var(--surface-3)',
              boxShadow: isCurrent ? `0 0 6px ${color}` : 'none',
            }}
          />
        )
      })}
    </div>
  )
}
