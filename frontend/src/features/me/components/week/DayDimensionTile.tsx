// ============================================================
// Napi értékelés · egy dimenzió-csempe (mezo-jcpt.4)
// Source: the approved day-evaluation prototype's `.predtile` (screens 1–2),
// translated into the Mozaik 2.0 kit: domain wash + two-layer coloured shadow,
// clay icon in a raised pic, poster anatomy (eyebrow + one big numeral in a
// conic sring), fact chips and the Mezo's one-sentence `why`.
//
// HONESTY: a dimension without a closed score is a GHOST tile — dashed border,
// a `—` sring and a status tag — never a 0 and never a part-way number. Its
// FACTS still show (a rest day is data: „edzés · Pihenőnap"), because the raw
// signal is true even when the judgement is not in yet.
//
// The wash/ink colours live in CSS (`.dev-dim.is-<id>` in styles/prototype.css,
// scoped under `.dev-dim` so the day page's `is-sleep` can never collide with
// the weekly mosaic's identically-named `.wkd-sparks i.is-sleep`).
// ============================================================
import type { CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { scoreBandColor } from '@/features/me/logic/scoreBand'
import type { DayDimensionKey } from '@/features/me/logic/weekDay'
import type { NormalizedDayDimension } from '@/data/me/dayEvaluation'

/** Which clay symbol speaks for each dimension (the prototype's own pairing). The COLOUR
 *  that goes with it is a CSS class, never a literal here. */
const DIMENSION_ICON: Record<DayDimensionKey, ClayIconName> = {
  nutrition: 'i-fuel',
  quality: 'i-termes',
  training: 'i-edzes',
  sleep: 'i-alvas',
  logging: 'i-naplo',
  rhythm: 'i-heti',
}

/** The status tag under the dimension name when there is no closed score yet. */
const STATUS_TAG: Record<'IN_PROGRESS' | 'NO_DATA', string> = {
  IN_PROGRESS: 'még íródik',
  NO_DATA: 'nincs adat',
}

/** The prototype's `.sring` — a conic band-coloured ring, or a dashed `—` when unscored.
 *  Shared with the day page's „Miből jött össze" strip. */
export function DayDimRing({ score, className }: { score: number | null; className?: string }) {
  const style = { '--c': scoreBandColor(score), '--v': score ?? 0 } as CSSProperties
  return (
    <div className={cn('dev-sring', score == null && 'is-dash', className)} style={style}>
      <i>{score ?? '—'}</i>
    </div>
  )
}

export function DayDimensionTile({ dimension, delayMs }: {
  dimension: NormalizedDayDimension
  delayMs: number
}) {
  const closed = dimension.status === 'DONE'
  return (
    <section
      className={cn('dev-dim rise', closed ? `is-${dimension.id}` : 'is-ghost')}
      style={{ '--d': `${delayMs}ms` } as CSSProperties}
    >
      <div className="dev-dimhead">
        <span className="dev-pic"><ClayIcon name={DIMENSION_ICON[dimension.id]} size={22} /></span>
        <div className="dev-dimname">
          <div className="dev-dnm">{dimension.label}</div>
          {closed ? (
            // The renormalised weight — a degraded dimension carries 0 and is not shown at all.
            <div className="mz-eyebrow dev-dwt">súly {Math.round(dimension.weight * 100)}%</div>
          ) : (
            <div className="dev-dwt">
              <span className="dev-stag">
                {dimension.status === 'IN_PROGRESS' ? STATUS_TAG.IN_PROGRESS : STATUS_TAG.NO_DATA}
              </span>
            </div>
          )}
        </div>
        <DayDimRing score={dimension.score} />
      </div>
      {dimension.facts.length > 0 && (
        <div className="dev-fchips">
          {dimension.facts.map((f) => (
            <span key={`${f.label}·${f.value}`} className="dev-fchip">{f.label} · {f.value}</span>
          ))}
        </div>
      )}
      {dimension.note != null && <p className={cn('dev-why', !closed && 'is-mut')}>{dimension.note}</p>}
    </section>
  )
}
