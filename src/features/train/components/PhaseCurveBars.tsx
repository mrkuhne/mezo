// ============================================================
// Mezo · PhaseCurveBars — one bar per phaseCurve entry, height keyed by phase.
// The current week's bar glows; past/future weeks dim. Each bar carries a W{n}
// label; the `lg` (builder hero) variant adds a phase label and a clipPath notch.
// Bars are coloured via MESOCYCLE_PHASE_COLORS.
//   sm = library mini bars (ActiveMesoCard) — no phase label, flat opacity.
//   lg = builder MesoOverview hero bars — status-aware opacity + phase label.
// Ported from prototype mesocycles.jsx ActiveMesoCard / MesoOverview phase curves.
// (DISTINCT from PhaseDots — that widget has its own colour map.)
// ============================================================
import { MESOCYCLE_PHASE_COLORS } from '@/data/train'
import type { MesoPhase, MesoStatus } from '@/data/types'

type PhaseCurveSize = 'sm' | 'lg'

// sm = library mini bars; lg = builder overview hero bars.
const BAR_HEIGHTS: Record<PhaseCurveSize, Record<MesoPhase, number>> = {
  sm: { MEV: 12, MAV: 24, MRV: 36, Deload: 8 },
  lg: { MEV: 18, MAV: 36, MRV: 52, Deload: 10 },
}

interface PhaseCurveBarsProps {
  phases: MesoPhase[]
  // 1-based current week within phaseCurve (matches Mesocycle.currentWeek).
  currentWeek: number
  size?: PhaseCurveSize
  // Drives the hero's status-aware opacity. When provided and not 'active',
  // every bar renders flat (0.6) with no glow — matching the prototype's
  // MesoOverview treatment for planned/archived mesos. Defaults to 'active'.
  status?: MesoStatus
}

export function PhaseCurveBars({ phases, currentWeek, size = 'sm', status = 'active' }: PhaseCurveBarsProps) {
  const isLg = size === 'lg'
  const containerHeight = isLg ? 60 : 36
  const heights = BAR_HEIGHTS[size]
  const isActive = status === 'active'
  return (
    <div className="row gap-xs" style={{ height: containerHeight, alignItems: 'flex-end' }}>
      {phases.map((p, i) => {
        const color = MESOCYCLE_PHASE_COLORS[p]
        const current = isActive && i + 1 === currentWeek
        const past = isActive && i + 1 < currentWeek
        // Active meso: current=1 (+glow), past=0.5, future fades.
        // The library mini bars (sm) fade future to 0.25; the builder hero (lg)
        // fades to 0.3 — both per the prototype. Non-active meso: flat 0.6.
        const future = isLg ? 0.3 : 0.25
        const opacity = isActive ? (current ? 1 : past ? 0.5 : future) : 0.6
        return (
          <div key={i} className="col flex-1" style={{ alignItems: 'center', gap: isLg ? 6 : 4 }}>
            <div
              style={{
                width: '100%',
                height: heights[p],
                background: color,
                opacity,
                boxShadow: current ? `0 0 12px ${color}` : 'none',
                ...(isLg && {
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%)',
                }),
                transition: 'all 0.3s ease',
              }}
            />
            <span
              className="label-mono"
              style={{ fontSize: 8, color: current ? 'var(--brand-glow)' : 'var(--text-tertiary)' }}
            >
              W{i + 1}
            </span>
            {isLg && (
              <span
                className="label-mono"
                style={{ fontSize: 7, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}
              >
                {p}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
