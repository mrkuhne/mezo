import type { CSSProperties } from 'react'
import type { GoalOverviewResponse } from '@/data/me/goalApi'

type Plans = GoalOverviewResponse['plans']
const DAY = ['', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']
const SPORT: Record<string, string> = { volleyball: 'Röplabda', handball: 'Kézilabda', running: 'Futás' }

function weekRange(from: number, to: number) {
  return from === to ? `W${from}` : `W${from}–${to}`
}

export function GoalConnectionTimeline({ plans, totalWeeks, onDetach }: {
  plans: Plans
  totalWeeks: number
  onDetach?: (linkId: string) => void
}) {
  const lanes = [
    { type: 'mesocycle' as const, label: 'Mesociklus' },
    { type: 'running_block' as const, label: 'Futóblokk' },
  ]
  return (
    <div className="goal-connection-stack">
      <section className="goal-detail-card goal-connection rise" aria-label="Kapcsolt tervek idővonala">
        <div className="goal-week-ruler" style={{ '--goal-weeks': totalWeeks } as CSSProperties} aria-hidden="true">{Array.from({ length: totalWeeks }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
        {lanes.map((lane) => (
          <div className="goal-plan-lane" key={lane.type}>
            <div className="goal-detail-kicker">{lane.label}</div>
            <div className="goal-plan-grid" style={{ '--goal-weeks': totalWeeks } as CSSProperties}>
              {plans.links.filter((link) => link.planType === lane.type).map((link) => (
                <div className={`goal-plan-bar goal-plan-${lane.type}`} key={link.id} style={{ gridColumn: `${link.startWeek} / ${Math.min(totalWeeks, link.endWeek) + 1}` }}>
                  <span><strong>{link.plan.title}</strong><small>{weekRange(link.startWeek, link.endWeek)} · {link.plan.status}</small></span>
                  {onDetach && <button type="button" aria-label={`${link.plan.title} leválasztása`} onClick={() => onDetach(link.id)}>×</button>}
                </div>
              ))}
              {plans.links.every((link) => link.planType !== lane.type) && <div className="goal-plan-empty">Nincs kapcsolt terv</div>}
            </div>
          </div>
        ))}
        {plans.gaps.length > 0 && <div className="goal-gap-row">{plans.gaps.map((gap) => <span key={`${gap.fromWeek}-${gap.toWeek}`}>{weekRange(gap.fromWeek, gap.toWeek)} fedezetlen</span>)}</div>}
      </section>
      <section className="goal-detail-card goal-sport-schedule rise" aria-label="Sport heti rend">
        <div className="goal-detail-kicker">Sport · heti rend</div>
        {plans.sportSchedule.length ? plans.sportSchedule.map((slot) => (
          <div className="goal-sport-row" key={slot.id}>
            <span><strong>{SPORT[slot.sport] ?? slot.sport}</strong><small>{slot.location || 'Helyszín nélkül'}</small></span>
            <span>{DAY[slot.dayOfWeek] ?? `Nap ${slot.dayOfWeek}`} · {slot.time} · {slot.durationMin} perc</span>
          </div>
        )) : <div className="goal-plan-empty">Nincs heti sportidőpont.</div>}
      </section>
    </div>
  )
}
