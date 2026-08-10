// ============================================================
// Mezo · WeekZoneCard — "Heti zóna-kontextus" card on the workout prep
// screen (mezo-oyhy.7, mockup variant A): per muscle group trained today,
// a three-segment ZoneTrack (done → TODAY → remaining plan) over the green
// optimal zone, with a status hint. Presentational — the caller selects
// rows (selectPrepRows) and counts the week's workouts.
// ============================================================
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { prepSegments, type WeekZoneRow } from '@/features/train/logic/weekZone'
import { ZoneTrack } from '@/features/train/components/ZoneTrack'

function hint(row: WeekZoneRow): { text: string; color: string } | null {
  switch (row.status) {
    case 'entering': return { text: '▲ a mai edzéssel zónába érsz', color: 'var(--sage-deep)' }
    case 'in': return row.mev === null ? null : { text: '✓ zónában', color: 'var(--sage-deep)' }
    case 'over': return { text: '⚠ a mai edzéssel túlmennél a kereten', color: 'var(--error)' }
    // Mid-week "below" is the norm on day 1 — the missing sets are usually still ahead
    // in the week's plan. Only call it a shortfall when the WHOLE week's plan misses MEV
    // (setsToZone > 0), which is exactly the planner card's `under` level; otherwise say
    // what's still coming, so the two cards stop reading as contradictory (mezo-zr6p).
    case 'below':
      return row.setsToZone > 0
        ? { text: `↓ a heti terv is a zóna alatt — még ${row.setsToZone} szett kellene`, color: 'var(--text-tertiary)' }
        : { text: `→ a héten még +${row.remainingPlanSets} szett jön a terv szerint`, color: 'var(--text-tertiary)' }
  }
}

export function WeekZoneCard({ rows, doneWorkouts, planWorkouts }: {
  rows: WeekZoneRow[]
  doneWorkouts: number
  planWorkouts: number
}) {
  if (rows.length === 0) return null
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Eyebrow brand>Heti zóna-kontextus</Eyebrow>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          kész {doneWorkouts}/{planWorkouts} edzés
        </span>
      </div>
      <div className="col" style={{ gap: 13, marginTop: 12 }}>
        {rows.map((row) => {
          const fam = muscleColor(row.colorMuscle)
          const h = hint(row)
          return (
            <div key={row.group} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 5, height: 34, borderRadius: 2, background: fam.rail, flexShrink: 0 }} />
              <div className="col flex-1" style={{ gap: 4, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{row.label}</span>
                  <span className="label-mono" style={{ fontSize: 10 }}>
                    kész {row.doneSets} · ma +{row.todaySets} · terv {row.plannedSets}
                  </span>
                </div>
                <ZoneTrack zoneStart={row.zoneStart} segments={prepSegments(row)} color={{ rail: fam.rail, deep: fam.deep }} />
                {h && <span style={{ fontSize: 10.5, color: h.color }}>{h.text}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
