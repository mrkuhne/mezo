// ============================================================
// Mezo · PhaseCurveBars — one bar per phaseCurve entry, height keyed by phase.
// The current week's bar glows, past weeks dim (0.5), future weeks fade (0.25);
// each bar carries a W{n} label. Bars are coloured via MESOCYCLE_PHASE_COLORS.
// `size` switches between the library (`sm`) and builder (`lg`) bar heights.
// Ported from prototype mesocycles.jsx ActiveMesoCard / MesoOverview phase curves.
// (DISTINCT from PhaseDots — that widget has its own colour map.)
// ============================================================
import { MESOCYCLE_PHASE_COLORS } from '@/data/train'
import type { MesoPhase } from '@/data/types'

type PhaseCurveSize = 'sm' | 'lg'

// sm = library mini bars; lg = builder overview hero bars (Task 8 reuse).
const BAR_HEIGHTS: Record<PhaseCurveSize, Record<MesoPhase, number>> = {
  sm: { MEV: 12, MAV: 24, MRV: 36, Deload: 8 },
  lg: { MEV: 18, MAV: 36, MRV: 52, Deload: 10 },
}

interface PhaseCurveBarsProps {
  phases: MesoPhase[]
  // 1-based current week within phaseCurve (matches Mesocycle.currentWeek).
  currentWeek: number
  size?: PhaseCurveSize
}

export function PhaseCurveBars({ phases, currentWeek, size = 'sm' }: PhaseCurveBarsProps) {
  const containerHeight = size === 'lg' ? 60 : 36
  const heights = BAR_HEIGHTS[size]
  return (
    <div className="row gap-xs" style={{ height: containerHeight, alignItems: 'flex-end' }}>
      {phases.map((p, i) => {
        const color = MESOCYCLE_PHASE_COLORS[p]
        const isCurrent = i + 1 === currentWeek
        const isPast = i + 1 < currentWeek
        return (
          <div key={i} className="col flex-1" style={{ alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: '100%',
                height: heights[p],
                background: color,
                opacity: isCurrent ? 1 : isPast ? 0.5 : 0.25,
                boxShadow: isCurrent ? `0 0 12px ${color}` : 'none',
                transition: 'all 0.3s ease',
              }}
            />
            <span
              className="label-mono"
              style={{ fontSize: 8, color: isCurrent ? 'var(--brand-glow)' : 'var(--text-tertiary)' }}
            >
              W{i + 1}
            </span>
          </div>
        )
      })}
    </div>
  )
}
