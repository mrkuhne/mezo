// Mezo · GoalStandingCard — „Célok állása" on the Én hub (mezo-lhqw7).
// Prototype: docs/design_2.0/prototypes/elo/en.html `hub()` `.goalcard .grows`. ONE coral glass
// button to the Célok tab; inside it flat rows, each in its own accent: the weight goal first
// (percentage + bar), then every ACTIVE life goal with the engine's direction.
// Honest states:
//  · the weight row exists only when its goal resolved (pending / failed / none → no row); a
//    goal with no computable progress shows no percentage and no bar — never „0%";
//  · a life goal's direction is omitted while the today-read is unresolved or failed, and when
//    the engine says `insufficient` — too little data is never a direction. A slipping goal
//    reads „figyelmet kér" in its own accent, never red;
//  · the percentage and the bar wait for the weight log: until it resolves the goal's „current"
//    weight is its start weight, which would print a fabricated „0%";
//  · a FAILED life-goals read is not „no goals": the weight row stays if it exists, but the card
//    claims no „n aktív" count and the „＋ Első cél" door is never offered;
//  · while the life goals load the card is absent (no flash of the empty door); with no row at
//    all the door to the wizard takes its place.
import { useNavigate } from 'react-router-dom'
import { ContentIcon, Icon3D } from '@/shared/ui/clay'
import { useGoal, useLifeGoals, useLifeGoalToday, useWeight } from '@/data/hooks'
import { ARROW_GLYPH, DIMENSIONS, DIMENSION_ACCENT } from '@/features/me/logic/lifegoalLabels'
import { progressPct } from '@/features/me/logic/weightStats'
import { hu1 } from '@/shared/lib/huNum'

const DIRECTION_WORD = { up: 'emelkedik', flat: 'tartja', down: 'figyelmet kér' } as const
const accent = (c: string) => ({ '--c': c } as React.CSSProperties)

export function GoalStandingCard() {
  const navigate = useNavigate()
  const { goal, pending: goalPending, isError: goalError } = useGoal()
  const { goals: lifeGoals, isPending: lifeGoalsPending, isError: lifeGoalsError } = useLifeGoals()
  const { isPending: weightPending, isError: weightError } = useWeight()
  const { today, isPending: todayPending, isError: todayError } = useLifeGoalToday()

  if (lifeGoalsPending) return null
  const weightGoal = !goalPending && !goalError ? goal : null
  const active = lifeGoals.filter((g) => g.status === 'active')
  const rowCount = active.length + (weightGoal != null ? 1 : 0)

  if (rowCount === 0) {
    // The weight goal may still be on its way, or the life goals failed to load — in neither
    // case do we know the user has no goal, so the empty door is not offered.
    if (goalPending || lifeGoalsError) return null
    return (
      <button type="button" className="enh-newgoal uv-empty rise"
        style={{ '--d': '180ms', '--c': 'var(--dv-coral)' } as React.CSSProperties}
        onClick={() => navigate('/me/goals/new')}>
        <strong>＋ Első cél</strong>
        <small>Mezo pilléreket javasol hozzá</small>
      </button>
    )
  }

  const todayHonest = !todayPending && !todayError
  const pct = weightGoal != null && !weightPending && !weightError ? progressPct(weightGoal.startWeight, weightGoal.currentWeight, weightGoal.targetWeight) : null

  return (
    <button type="button" className="enh-goalcard glass rise"
      style={{ '--d': '180ms', '--c': 'var(--dv-coral)' } as React.CSSProperties}
      aria-label="Célok állása" onClick={() => navigate('/me/goals')}>
      <span className="enh-goalhead">
        <Icon3D name="t-ring" size={36} />
        <span className="enh-goalttl">Célok állása</span>
        {!lifeGoalsError && <span className="enh-stch">{rowCount} aktív</span>}
      </span>
      <span className="enh-grows">
        {weightGoal != null && (
          <span className="enh-grow" style={accent('var(--dv-coral)')}>
            <Icon3D name="t-weight" size={28} />
            <span className="enh-gbody">
              <span className="enh-gline">
                <strong>Súlycél · {hu1(weightGoal.currentWeight)} → {hu1(weightGoal.targetWeight)} kg</strong>
                {pct != null && <b>{pct}%</b>}
              </span>
              {pct != null && <span className="uv-bar" style={{ '--w': `${pct}%` } as React.CSSProperties}><b /></span>}
            </span>
          </span>
        )}
        {active.map((g) => {
          const summary = todayHonest ? today.goals.find((s) => s.goalId === g.id) : undefined
          const direction = summary != null && summary.arrow !== 'insufficient' ? summary.arrow : null
          const todayCount = summary != null && (summary.pillarsTotal ?? 0) > 0
            ? `${summary.pillarsHitToday ?? 0}/${summary.pillarsTotal} ma` : null
          const sub = [direction != null ? DIRECTION_WORD[direction] : null, todayCount].filter(Boolean).join(' · ')
          return (
            <span key={g.id} className="enh-grow" style={accent(DIMENSION_ACCENT[g.dimension])}>
              <ContentIcon name={DIMENSIONS[g.dimension].icon} size={28} />
              <span className="enh-gbody">
                <span className="enh-gline">
                  <strong>{g.title}</strong>
                  {direction != null && <b className="enh-garr" aria-hidden="true">{ARROW_GLYPH[direction]}</b>}
                </span>
                {sub !== '' && <small>{sub}</small>}
              </span>
            </span>
          )
        })}
      </span>
    </button>
  )
}
