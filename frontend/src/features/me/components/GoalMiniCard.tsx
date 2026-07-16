import { useNavigate } from 'react-router-dom'
import { useGoal } from '@/data/hooks'
import { TRAJECTORY_LABEL } from '@/features/me/logic/goalLabels'
import { hu1 } from '@/shared/lib/huNum'

/** Profil goal mini-track (spec §4.6) — compact progress card, taps through to /me/goals. */
export function GoalMiniCard() {
  const navigate = useNavigate()
  const { goal, goalResponse, pending } = useGoal()
  if (pending || !goal || !goalResponse) return null

  // Signed math so bulk (negative/negative) still lands in 0..100; maintain (total 0) hides the track.
  const total = goal.startWeight - goal.targetWeight
  const progressed = goal.startWeight - goal.currentWeight
  const p = total !== 0 ? Math.min(100, Math.max(0, (progressed / total) * 100)) : 0
  const remaining = Math.abs(goal.currentWeight - goal.targetWeight)

  return (
    <button type="button" className="card notch-12 goalmini np-press" onClick={() => navigate('/me/goals')}>
      <span className="sr-only">Cél oldal megnyitása — </span>
      <div className="row1">
        <div className="t">🎯 {TRAJECTORY_LABEL[goalResponse.trajectory]} · {goalResponse.title}</div>
        <div className="pct">{total !== 0 ? `${Math.round(p)}% · ${hu1(remaining)} kg hátra` : 'tartás'}</div>
      </div>
      {total !== 0 && (
        <>
          <div className="track">
            <div className="fill" style={{ width: `${p}%` }} />
            <div className="dot" style={{ left: `${p}%` }} />
          </div>
          <div className="track-l">
            <span>{hu1(goal.startWeight)}</span>
            <span style={{ color: 'var(--sage-deep)' }}>{hu1(goal.currentWeight)} most</span>
            <span>{hu1(goal.targetWeight)} cél</span>
          </div>
        </>
      )}
    </button>
  )
}
