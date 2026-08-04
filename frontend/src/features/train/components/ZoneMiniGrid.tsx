// ============================================================
// Mezo · ZoneMiniGrid — two-column live mini zone bars for the GymPage
// meta card (mezo-oyhy.7, mockup variant C): per muscle group, done (solid)
// + remaining plan (ghost) on the green optimal zone, `{done}/{plan}`
// numerics. Marks describe the WEEKLY PLAN (the old pill grid's semantics):
// ⚠ = plan over budget, ↓ = plan under its MEV.
// ============================================================
import { muscleColor } from '@/features/train/logic/muscleColors'
import { gymSegments, type WeekZoneRow } from '@/features/train/logic/weekZone'
import { ZoneTrack } from '@/features/train/components/ZoneTrack'

export function ZoneMiniGrid({ rows }: { rows: WeekZoneRow[] }) {
  if (rows.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
      {rows.map((row) => {
        const fam = muscleColor(row.colorMuscle)
        const planOver = row.planBudget > 1
        const planUnder = row.mev !== null && row.plannedSets < row.mev
        const numeric = `${row.doneSets}/${row.plannedSets}${planOver ? ' ⚠' : planUnder ? ' ↓' : ''}`
        return (
          <div key={row.group}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 10.5 }}>{row.label}</span>
              <span className="label-mono" style={{ fontSize: 9, color: planOver ? 'var(--error)' : 'var(--text-tertiary)' }}>
                {numeric}
              </span>
            </div>
            <ZoneTrack zoneStart={row.zoneStart} segments={gymSegments(row)} color={{ rail: fam.rail, deep: fam.deep }} height={7} />
          </div>
        )
      })}
    </div>
  )
}
