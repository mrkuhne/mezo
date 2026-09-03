import { ClayIcon } from '@/shared/ui/clay'
import type { LifeGoalResponse, LifeGoalTodaySummary } from '@/data/lifegoal/lifegoalApi'
import { ARROW_CLASS, ARROW_GLYPH, DIMENSIONS, DOT_CLASS } from '@/features/me/logic/lifegoalLabels'

// Goal tile (prototype .gtile): eyebrow = dimension, name, clay icon + the weekly arrow slot,
// seven dots. `summary` (Task 8's useLifeGoalToday, matched by goalId) drives the live arrow +
// dots once it resolves; `undefined` — and an `insufficient` arrow once it does resolve — keeps
// the SAME honest placeholder as before (the Task 9 guardrail: never invent a direction out of
// too little data).
export function LifeGoalTile({
  goal, summary, delayMs, onClick,
}: {
  goal: LifeGoalResponse
  summary?: LifeGoalTodaySummary
  delayMs: number
  onClick: () => void
}) {
  const dim = DIMENSIONS[goal.dimension]
  const honest = !summary || summary.arrow === 'insufficient'
  const arrowClass = honest ? 'none' : ARROW_CLASS[summary!.arrow]
  const arrowGlyph = honest ? '—' : ARROW_GLYPH[summary!.arrow]
  const days7 = summary ? summary.days7.slice(-7) : Array.from({ length: 7 }, () => null)
  return (
    <button type="button" className={`mz-tile lg-tile rise ${dim.cls}`} style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
      onClick={onClick} aria-label={goal.title}>
      <div className="mz-tile-top"><span className="mz-eyebrow">{dim.label}</span></div>
      <div className="nm">{goal.title}</div>
      <div className="row gap-sm" style={{ alignItems: 'center', marginTop: 4 }}>
        <ClayIcon name={dim.icon} size={34} />
        <span className={`lg-arrow ${arrowClass}`}><span className="g">{arrowGlyph}</span></span>
      </div>
      <div className="lg-wk7" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
        {days7.map((status, i) => <i key={i} className={status ? DOT_CLASS[status] : 'n'} style={{ '--i': i } as React.CSSProperties} />)}
        <span className="lbl">{summary ? `${summary.pillarsHitToday ?? 0}/${summary.pillarsTotal ?? 0} ma` : 'még nincs adat'}</span>
      </div>
    </button>
  )
}
