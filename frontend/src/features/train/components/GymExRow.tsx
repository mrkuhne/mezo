// ============================================================
// Mezo · GymExRow — one exercise line inside the GymDaySheet.
// Left accent border keys off exercise kind (compound = brand glow,
// isolation = preference). Shows index / Antonio name / type · muscle,
// optional amber warning banner, and the recipe summary (warmup+working /
// rep-range · RIR) on the right.
// Ported from prototype train-views.jsx GymExRow.
// ============================================================
import { Icon } from '@/shared/ui/Icon'
import type { GymExercise } from '@/data/types'

interface GymExRowProps {
  ex: GymExercise
  idx: number
}

export function GymExRow({ ex, idx }: GymExRowProps) {
  const typeColor = ex.type === 'compound' ? 'var(--coral)' : 'var(--cat-preference)'
  return (
    <div className="card" style={{ padding: '12px 14px', borderLeft: `2px solid ${typeColor}` }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>{String(idx).padStart(2, '0')}</span>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {ex.name}
            </span>
          </div>
          <div className="row gap-md mt-xs" style={{ fontSize: 10 }}>
            <span style={{ color: typeColor }}>{ex.type}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>· {ex.muscle}</span>
          </div>
          {ex.warning && (
            <div
              className="row gap-xs mt-sm"
              style={{
                padding: '4px 6px',
                background: 'color-mix(in srgb, var(--warning) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)',
                alignItems: 'flex-start',
              }}
            >
              <Icon name="warning" size={9} color="var(--warning)" />
              <span style={{ fontSize: 10, color: 'var(--warning)', lineHeight: 1.4 }}>{ex.warning}</span>
            </div>
          )}
        </div>
        <div className="col" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: typeColor, lineHeight: 1 }}>
            {ex.warmupSets}+{ex.workingSets}
          </span>
          <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>{ex.repMin}-{ex.repMax} · RIR {ex.targetRIR}</span>
        </div>
      </div>
    </div>
  )
}
