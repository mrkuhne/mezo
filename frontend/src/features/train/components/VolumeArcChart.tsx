// ============================================================
// Mezo · VolumeArcChart — whole-mesocycle per-muscle volume arc (Phase B,
// Task B4). Read-only: one bar column per week, planned (dashed) vs actual
// (solid, muscle color), deload weeks amber, current week glowing, an MRV
// ceiling caption. Mirrors the PhaseCurveBars idiom (inline styles + the
// row/col/flex-1/label-mono utility classes) — no prototype.css changes.
// Presentational only: pure props → view, no hooks/data. Mounted by
// MesoOverviewPage (Task B5) behind a per-muscle switch.
// ============================================================
import type { MuscleVolumeArc } from '@/data/types'
import { muscleColor } from '@/features/train/logic/muscleColors'

const MAX_H = 96

export function VolumeArcChart({ arc }: { arc: MuscleVolumeArc }) {
  const { mrv } = arc
  const scale = (value: number): number => (mrv > 0 ? Math.round((value / mrv) * MAX_H) : 0)

  return (
    <div className="col gap-sm" data-testid="volume-arc-chart">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          Heti szett
        </span>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          MRV {mrv}
        </span>
      </div>
      <div className="row gap-xs" style={{ height: MAX_H + 24, alignItems: 'flex-end' }}>
        {arc.weeks.map((w) => {
          const deload = w.phase === 'Deload'
          const color = deload ? 'var(--amber)' : muscleColor(arc.muscle).rail
          const plannedH = scale(w.planned)
          const actualH = w.actual != null ? scale(w.actual) : 0
          return (
            <div
              key={w.week}
              className="col flex-1"
              data-testid={`arc-week-${w.week}`}
              data-current={w.isCurrent ? 'true' : undefined}
              data-phase={w.phase}
              style={{ alignItems: 'center', gap: 4 }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: MAX_H,
                  display: 'flex',
                  alignItems: 'flex-end',
                }}
              >
                {/* planned (dashed target) */}
                <div
                  data-testid={`arc-planned-${w.week}`}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    width: '100%',
                    height: plannedH,
                    borderColor: color,
                    borderStyle: 'dashed',
                    borderWidth: 1,
                    borderRadius: 2,
                    opacity: 0.6,
                    background: 'transparent',
                  }}
                />
                {/* actual (solid) — only when logged */}
                {w.actual != null && (
                  <div
                    data-testid={`arc-actual-${w.week}`}
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: actualH,
                      background: color,
                      borderRadius: 2,
                      opacity: w.isCurrent ? 1 : 0.85,
                      boxShadow: w.isCurrent ? `0 0 12px ${color}` : 'none',
                    }}
                  />
                )}
              </div>
              <span
                className="label-mono"
                style={{ fontSize: 8, color: w.isCurrent ? 'var(--coral)' : 'var(--text-tertiary)' }}
              >
                W{w.week}
              </span>
              <span
                className="label-mono"
                style={{ fontSize: 7, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}
              >
                {w.phase}
              </span>
            </div>
          )
        })}
      </div>
      <div className="row gap-md" style={{ justifyContent: 'center' }}>
        <span className="row gap-xs" style={{ alignItems: 'center' }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: muscleColor(arc.muscle).rail,
              display: 'inline-block',
            }}
          />
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
            Tényleges
          </span>
        </span>
        <span className="row gap-xs" style={{ alignItems: 'center' }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              borderColor: muscleColor(arc.muscle).rail,
              borderStyle: 'dashed',
              borderWidth: 1,
              display: 'inline-block',
            }}
          />
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
            Terv
          </span>
        </span>
        <span className="row gap-xs" style={{ alignItems: 'center' }}>
          <span
            style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--amber)', display: 'inline-block' }}
          />
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
            Deload
          </span>
        </span>
      </div>
    </div>
  )
}
