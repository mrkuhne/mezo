// ============================================================
// Mezo · ActiveMesoCard — brand hero card for the running mesocycle:
// gradient + 3px brand left strip + radial glow, eyebrow / Display title /
// goal / chevron, the phase-curve mini bars, and a Split/Stílus/Vége meta row.
// The whole card navigates to the builder. Ported from prototype
// mesocycles.jsx ActiveMesoCard. Brand tints use color-mix against
// --coral (matching the SportPage hero idiom); the border uses the
// --line design token.
// ============================================================
import { MESOCYCLE_PHASE_COLORS } from '@/data/train/train'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { Icon } from '@/shared/ui/Icon'
import type { Mesocycle } from '@/data/types'
import { PhaseCurveBars } from '@/features/train/components/PhaseCurveBars'
import { MetaStat } from '@/features/train/components/MetaStat'

interface ActiveMesoCardProps {
  meso: Mesocycle
  onOpen: () => void
}

export function ActiveMesoCard({ meso, onOpen }: ActiveMesoCardProps) {
  const currentPhase = meso.phaseCurve[meso.currentWeek - 1]
  const [splitHead, splitTail] = meso.split.split(' · ')
  const [styleHead, styleTail] = meso.style.split(' · ')

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card"
      style={{
        padding: 0,
        width: '100%',
        textAlign: 'left',
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--coral) 6%, transparent) 0%, var(--surface-1) 70%)',
        borderColor: 'var(--line)',
        position: 'relative',
      }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--coral)' }} />
      <span
        style={{
          position: 'absolute',
          right: -50,
          top: -50,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--coral) 12%, transparent), transparent 70%)',
        }}
      />

      <div style={{ padding: 20, position: 'relative' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="col">
            <Eyebrow brand>
              Aktív · Week {meso.currentWeek}/{meso.weeks}
            </Eyebrow>
            <div style={{ marginTop: 6 }}>
              <Display size="lg">{meso.title}</Display>
            </div>
            <span className="text-secondary mt-sm" style={{ fontSize: 12 }}>
              {meso.goal}
            </span>
          </div>
          <Icon name="chevron-right" size={20} color="var(--coral)" />
        </div>

        {/* Phase curve */}
        <div style={{ marginTop: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="label-mono" style={{ fontSize: 9 }}>
              Fázis görbe
            </span>
            <span className="label-mono" style={{ fontSize: 9, color: MESOCYCLE_PHASE_COLORS[currentPhase] }}>
              {currentPhase} · most
            </span>
          </div>
          <PhaseCurveBars phases={meso.phaseCurve} currentWeek={meso.currentWeek} size="sm" />
        </div>

        {/* Meta row */}
        <div
          className="row gap-md mt-lg"
          style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}
        >
          <MetaStat label="Split" val={splitHead} sub={splitTail} />
          <MetaStat label="Stílus" val={styleHead} sub={styleTail} />
          <MetaStat label="Vége" val={meso.endDate} />
        </div>
      </div>
    </button>
  )
}
