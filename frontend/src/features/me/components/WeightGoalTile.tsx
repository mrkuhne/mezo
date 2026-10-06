import { Icon3D } from '@/shared/ui/clay'
import { useGoal, useWeight } from '@/data/hooks'
import { TRAJECTORY_LABEL } from '@/features/me/logic/goalLabels'
import { etaWeeks, progressPct } from '@/features/me/logic/weightStats'
import { huSigned } from '@/features/me/logic/huSigned'
import { hu1 } from '@/shared/lib/huNum'

// Weight goal as the FIRST goal tile on Célok (mezo-lhqw7; prototype en.html celok() `.wgoal2`).
// Same size and rhythm as LifeGoalTile. Honest states: nothing while the goal is pending / failed /
// absent (the page owns those slots); the percentage and bar wait for the weight log — until it
// resolves the goal's „current" weight is its start weight, which would print a fabricated „0%";
// the pace line is omitted at a zero rate, its ETA part when no ETA can be computed.
export function WeightGoalTile({ delayMs, onClick }: { delayMs: number; onClick: () => void }) {
  const { goal, goalResponse, pending, isError } = useGoal()
  const { weightTrends, isPending: logPending, isError: logError } = useWeight()
  if (pending || isError || goal == null || goalResponse == null) return null

  const pct = !logPending && !logError ? progressPct(goal.startWeight, goal.currentWeight, goal.targetWeight) : null
  const rate = weightTrends.last4w.weeklyRate
  const eta = etaWeeks(goal.currentWeight, goal.targetWeight, rate)
  const pace = rate === 0 ? null : `${huSigned(rate)} kg / hét${eta != null ? ` · kb. ${eta} hét` : ''}`

  return (
    <button type="button" className="mz-tile lg-tile enc-tile enc-wgoal glass rise"
      style={{ '--c': 'var(--dv-coral)', '--d': `${delayMs}ms` } as React.CSSProperties}
      onClick={onClick} aria-label="Súlycél">
      <span className="enc-tile-top">
        <Icon3D name="t-weight" size={40} />
        {pct != null && <span className="enc-wgoal-pct">{pct}%</span>}
      </span>
      <span className="mz-eyebrow">Súlycél · Egészség</span>
      <span className="nm">{TRAJECTORY_LABEL[goalResponse.trajectory]} · {hu1(goal.currentWeight)} → {hu1(goal.targetWeight)} kg</span>
      {pct != null && <span className="uv-bar" style={{ '--w': `${pct}%` } as React.CSSProperties}><b /></span>}
      {pace != null && <span className="enc-wgoal-pace">{pace}</span>}
    </button>
  )
}
