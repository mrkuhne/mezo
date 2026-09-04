import type { GoalOverviewResponse } from '@/data/me/goalApi'
import { hu1 } from '@/shared/lib/huNum'

type Status = NonNullable<GoalOverviewResponse['guards']['status']>

export function GoalGuardCard({ kind, status }:
  | { kind: 'strength'; status: Status['strength'] }
  | { kind: 'muscle'; status: Status['muscle'] }) {
  const inactive = !status.active
  const alert = kind === 'strength'
    ? status.breached
    : status.belowMaintenanceMuscles.length > 0 || !status.rateWithinCap
  const title = kind === 'strength' ? 'Erővédelem' : 'Izomvédelem'
  const state = inactive ? 'Nincs bekapcsolva' : alert ? 'Beavatkozás kell' : 'Rendben'
  return (
    <section className={`goal-detail-card goal-guard-card rise ${inactive ? 'goal-guard-inactive' : alert ? 'goal-guard-alert' : 'goal-guard-ok'}`}>
      <div className="goal-guard-head"><span className="goal-detail-kicker">{title}</span><b>{state}</b></div>
      {!inactive && kind === 'strength' && <strong className="goal-guard-value">{status.e1rmTrendPct < 0 ? '−' : '+'}{hu1(Math.abs(status.e1rmTrendPct))}%</strong>}
      {!inactive && kind === 'muscle' && (
        <div className="goal-guard-metrics">
          <span><b>≥{status.minWeeklySetsPerMuscle}</b><small>szett / izom</small></span>
          <span><b>{status.belowMaintenanceMuscles.length}</b><small>minimum alatt</small></span>
        </div>
      )}
      {status.notes.length > 0 && <ul>{status.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
    </section>
  )
}
