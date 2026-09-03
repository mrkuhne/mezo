import { ClayIcon } from '@/shared/ui/clay'
import type { LifeGoalResponse } from '@/data/lifegoal/lifegoalApi'
import { DIMENSIONS } from '@/features/me/logic/lifegoalLabels'

// Goal tile (prototype .gtile): eyebrow = dimension, name, clay icon + the weekly arrow slot,
// seven dots. Slice 1 has no scorer yet, so the arrow is the honest `—` and the dots are dashed.
export function LifeGoalTile({ goal, delayMs, onClick }: { goal: LifeGoalResponse; delayMs: number; onClick: () => void }) {
  const dim = DIMENSIONS[goal.dimension]
  return (
    <button type="button" className={`mz-tile lg-tile rise ${dim.cls}`} style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
      onClick={onClick} aria-label={goal.title}>
      <div className="mz-tile-top"><span className="mz-eyebrow">{dim.label}</span></div>
      <div className="nm">{goal.title}</div>
      <div className="row gap-sm" style={{ alignItems: 'center', marginTop: 4 }}>
        <ClayIcon name={dim.icon} size={34} />
        <span className="lg-arrow none"><span className="g">—</span></span>
      </div>
      <div className="lg-wk7" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
        {Array.from({ length: 7 }, (_, i) => <i key={i} className="n" style={{ '--i': i } as React.CSSProperties} />)}
        <span className="lbl">még nincs adat</span>
      </div>
    </button>
  )
}
