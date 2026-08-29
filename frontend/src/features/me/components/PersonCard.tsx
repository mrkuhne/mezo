import { affectColor } from '@/data/me/people'
import type { PersonEntry } from '@/data/types'

/**
 * Mozaik re-face (mezo-d20.6.7) — prototype en-body .persont: a 2-col washed
 * rose tile, initial ringed by a conic-gradient "affect ring". Unlike the
 * prototype's decorative demo percentages, the ring's fill is derived from the
 * person's own latest affectTrend reading (a 1–5 scale) — a real number, never
 * a fabricated one; --ac/--av are element-local custom props, not tokens.
 */
export function PersonCard({ person, delayMs, onTap }: { person: PersonEntry; delayMs?: number; onTap?: () => void }) {
  const color = affectColor(person.affect_baseline)
  const last = person.affectTrend[person.affectTrend.length - 1] ?? 0
  const ringPct = Math.max(0, Math.min(100, Math.round((last / 5) * 100)))
  const style = {
    '--ac': color,
    '--av': `${ringPct}%`,
    ...(delayMs !== undefined ? { '--d': `${delayMs}ms` } : {}),
  } as React.CSSProperties

  return (
    <button type="button" onClick={onTap} className="ppl-tile rise" style={style} aria-label={`${person.name} részletei`}>
      <div className="ppl-avat">
        <div className="ppl-avin" style={{ color }}>{person.initial}</div>
      </div>
      <span className="ppl-nm">{person.name}</span>
      <span className="ppl-rl">{person.relationshipHu}</span>
      <span className="ppl-mt">{person.mentionsThisWeek}× · e héten · {person.mentionCount} mention</span>
    </button>
  )
}
