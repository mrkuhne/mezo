// ============================================================
// Mezo · MesoOverview (builder · Áttekintés) — the phase-curve hero card
// (status-aware lg PhaseCurveBars + MEV/MAV/MRV/Deload legend) followed by
// the `Heti terv` list of tappable day rows. Tapping a row opens the
// DayDetailSheet. Guards mesos that lack a `days` array (planned/archived).
// Ported from prototype mesocycles.jsx MesoOverview.
// ============================================================
import { useState } from 'react'
import { MESOCYCLE_PHASE_COLORS } from '@/data/train'
import type { MesoDay, Mesocycle, MesoPhase } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { Chip } from '@/shared/ui/Chip'
import { PhaseCurveBars } from '@/features/train/components/PhaseCurveBars'
import { DayDetailSheet } from '@/features/train/components/DayDetailSheet'

const LEGEND_PHASES: MesoPhase[] = ['MEV', 'MAV', 'MRV', 'Deload']

export function MesoOverview({ meso, onEditDay }: { meso: Mesocycle; onEditDay?: () => void }) {
  const [selectedDay, setSelectedDay] = useState<MesoDay | null>(null)
  const days = meso.days ?? []
  const currentPhase = meso.phaseCurve[meso.currentWeek - 1]

  return (
    <div className="col">
      {/* Phase curve hero */}
      <div style={{ padding: '12px 24px' }}>
        <div className="card notch-12" style={{ padding: 18 }}>
          <div
            className="row gap-sm flex-wrap"
            style={{ justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span className="eyebrow">Fázis görbe</span>
            {meso.status === 'active' && currentPhase && (
              <span
                className="label-mono"
                style={{ fontSize: 9, color: MESOCYCLE_PHASE_COLORS[currentPhase] }}
              >
                W{meso.currentWeek} · {currentPhase} · most
              </span>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <PhaseCurveBars
              phases={meso.phaseCurve}
              currentWeek={meso.currentWeek}
              size="lg"
              status={meso.status}
            />
          </div>

          {/* Legend */}
          <div
            className="row gap-md mt-md"
            style={{ justifyContent: 'center', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}
          >
            {LEGEND_PHASES.map((p) => (
              <div key={p} className="row gap-xs">
                <div
                  style={{ width: 6, height: 6, borderRadius: '50%', background: MESOCYCLE_PHASE_COLORS[p] }}
                />
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>
                  {p}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly schedule */}
      <div style={{ padding: '8px 24px' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Heti terv
        </div>
        {days.length > 0 ? (
          <div className="col gap-sm">
            {days.map((d, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${d.type} · ${d.day}`}
                onClick={() => setSelectedDay(d)}
                className="card notch-4 row"
                style={{
                  padding: 12,
                  alignItems: 'center',
                  textAlign: 'left',
                  width: '100%',
                  borderColor: d.current ? 'var(--border-brand)' : 'var(--border-subtle)',
                  background: d.current
                    ? 'color-mix(in srgb, var(--brand-glow) 4%, transparent)'
                    : 'var(--surface-1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {d.current && (
                  <div
                    style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--brand-glow)' }}
                  />
                )}
                <span
                  className="label-mono"
                  style={{
                    width: 36,
                    color: d.current ? 'var(--brand-glow)' : 'var(--text-tertiary)',
                    fontSize: 10,
                    marginLeft: d.current ? 6 : 0,
                  }}
                >
                  {d.day}
                </span>
                <div className="col flex-1">
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{d.type}</span>
                  {d.muscle && d.exerciseCount > 0 && (
                    <span
                      className="text-tertiary"
                      style={{ fontSize: 10, fontFamily: 'var(--ff-mono)', marginTop: 2 }}
                    >
                      {d.muscle} · {d.exerciseCount} gyakorlat
                    </span>
                  )}
                </div>
                {d.current && (
                  <Chip variant="brand" style={{ fontSize: 9, padding: '2px 6px' }}>
                    MA
                  </Chip>
                )}
                <Icon name="chevron-right" size={12} color="var(--text-tertiary)" />
              </button>
            ))}
          </div>
        ) : (
          <span className="text-tertiary" style={{ fontSize: 12, fontFamily: 'var(--ff-mono)' }}>
            Heti terv még nincs összeállítva.
          </span>
        )}
      </div>

      {selectedDay && (
        <DayDetailSheet
          day={selectedDay}
          meso={meso}
          onClose={() => setSelectedDay(null)}
          onEdit={onEditDay}
        />
      )}
    </div>
  )
}
