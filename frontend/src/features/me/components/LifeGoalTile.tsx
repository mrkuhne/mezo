import { ContentIcon } from '@/shared/ui/clay'
import type { LifeGoalResponse, LifeGoalTodaySummary } from '@/data/lifegoal/lifegoalApi'
import { ARROW_CLASS, ARROW_GLYPH, DIMENSIONS, DOT_CLASS } from '@/features/me/logic/lifegoalLabels'

// Goal tile (prototype .gtile → üveg `.lgtile`, mezo-me75u.6): a glass tile in the goal's
// dimension colour — the 3D dimension icon + the weekly arrow slot, the dimension eyebrow, the
// name, seven dots and "x/y ma". `summary` (Task 8's useLifeGoalToday, matched by goalId) drives
// the live arrow + dots once it resolves; `undefined` — and an `insufficient` arrow once it does
// resolve — keeps the SAME honest placeholder as before (the Task 9 guardrail: never invent a
// direction out of too little data). The `--c` accent comes from the `lg-d-*` class on the SAME
// element that wears `.glass` (bible U1 rule 4; mapped in the `uveg en celok` CSS block).
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
    <button type="button" className={`mz-tile enc-tile glass rise ${dim.cls}`} style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
      onClick={onClick} aria-label={goal.title}>
      <span className="enc-tile-top">
        <ContentIcon name={dim.icon} size={40} />
        <span className={`lg-arrow ${arrowClass}`}><span className="g">{arrowGlyph}</span></span>
      </span>
      <span className="mz-eyebrow">{dim.label}</span>
      <span className="nm">{goal.title}</span>
      <span className="lg-wk7" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
        {days7.map((status, i) => <i key={i} className={status ? DOT_CLASS[status] : 'n'} style={{ '--i': i } as React.CSSProperties} />)}
        <span className="lbl">{summary ? `${summary.pillarsHitToday ?? 0}/${summary.pillarsTotal ?? 0} ma` : 'még nincs adat'}</span>
      </span>
    </button>
  )
}
