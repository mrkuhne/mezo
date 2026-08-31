import { affectColor } from '@/data/me/people'
import type { MentionContext, PersonEntry } from '@/data/types'
import { CTX_META } from '@/features/me/logic/peopleVisuals'

/**
 * Mozaik re-face (mezo-d20.6.7) — prototype en-body .persont: a 2-col washed
 * rose tile, initial ringed by a conic-gradient "affect ring". Unlike the
 * prototype's decorative demo percentages, the ring's fill is derived from the
 * person's own latest affectTrend reading (a 1–5 scale) — a real number, never
 * a fabricated one; --ac/--av are element-local custom props, not tokens.
 *
 * Emberek S3 "A köröm" (mezo-06o0.2): two more OPTIONAL, honestly-empty props —
 * `spark` (Task 1's `trendHeights` px-heights, prototype sparkHtml() ported as
 * `.ppl-spark`/`.ppl-spark i`) and `ctxDots` (Task 1's `contextBreakdown` top-3
 * contexts, prototype ctxDots() ported as `.ppl-ctxdots`/`.ppl-ctxdots i`). A
 * caller that never passes them (or passes an empty array — no trend points, no
 * context-labeled mentions) sees no empty container rendered — never a fabricated
 * flat bar or a colorless dot.
 */
export function PersonCard({ person, delayMs, onTap, spark, ctxDots }: {
  person: PersonEntry
  delayMs?: number
  onTap?: () => void
  spark?: number[]
  ctxDots?: MentionContext[]
}) {
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
      {spark && spark.length > 0 && (
        <div className="ppl-spark">
          {spark.map((h, i) => (
            <i
              key={i}
              style={{
                height: `${h}px`,
                background: color,
                opacity: 0.45 + i * 0.07,
                '--d': `${250 + i * 40}ms`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
      {ctxDots && ctxDots.length > 0 && (
        <div className="ppl-ctxdots">
          {ctxDots.slice(0, 3).map((ctx, i) => (
            <i key={`${ctx}-${i}`} style={{ background: `var(${CTX_META[ctx].cssVar})` }} />
          ))}
        </div>
      )}
      <span className="ppl-mt">{person.mentionsThisWeek}× e héten · {person.mentionCount} említés</span>
    </button>
  )
}
