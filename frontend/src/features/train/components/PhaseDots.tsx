// ============================================================
// Mezo · PhaseDots — one dot per phaseCurve entry. The current week's dot is
// enlarged + glowing; future dots are dimmed to surface-3.
// Ported from prototype train-views.jsx PhaseDots (NOTE: this widget uses its
// OWN phase→colour map — distinct from mesocycles.jsx MESOCYCLE_PHASE_COLORS,
// which the library/builder phase-curve bars use).
// ============================================================
import type { MesoPhase } from '@/data/types'

// Prototype train-views.jsx `colorFor`: MEV→tertiary, MAV→coral (ex brand-glow),
// MRV→warning, Deload→cat-preference (fallback text-secondary).
function colorFor(p: MesoPhase): string {
  return p === 'MEV'
    ? 'var(--text-tertiary)'
    : p === 'MAV'
      ? 'var(--coral)'
      : p === 'MRV'
        ? 'var(--warning)'
        : p === 'Deload'
          ? 'var(--cat-preference)'
          : 'var(--text-secondary)'
}

interface PhaseDotsProps {
  phases: MesoPhase[]
  // Zero-based index of the current week within phaseCurve.
  current: number
}

export function PhaseDots({ phases, current }: PhaseDotsProps) {
  return (
    <div className="row gap-xs" style={{ alignItems: 'center' }}>
      {phases.map((p, i) => {
        const color = colorFor(p)
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
