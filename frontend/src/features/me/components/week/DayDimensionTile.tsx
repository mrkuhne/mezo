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
// The wash/ink colours live in CSS (`.dayev-dim.is-<id>` in styles/prototype.css,
// scoped under `.dayev-dim` so the day page's `is-sleep` can never collide with
// the weekly mosaic's identically-named `.wkd-sparks i.is-sleep`).
// ============================================================
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { scoreBandColor } from '@/features/me/logic/scoreBand'
import type { DayDimensionKey } from '@/features/me/logic/weekDay'
import type { DimensionStatus, NormalizedDayDimension } from '@/data/me/dayEvaluation'

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

/** The status tag shown instead of the weight eyebrow while the DAY is still open. `DONE` is
 *  the prototype's screen-2 `stag done` — on an open day a finalised dimension has to SAY it is
 *  final, otherwise a full wash tile is indistinguishable from one that simply has data so far. */
const STATUS_TAG: Record<DimensionStatus, string> = {
  DONE: 'kész',
  IN_PROGRESS: 'még íródik',
  NO_DATA: 'nincs adat',
}

/** The prototype's `.sring` — a conic band-coloured ring, or a dashed `—` when unscored.
 *  Shared with the day page's „Miből jött össze" strip. `label` names the dimension so the
 *  ring announces „Alvás · 80 / 100" instead of a bare numeral (or, unscored, a bare dash). */
export function DayDimRing({ score, label, decorative, className }: {
  score: number | null
  label: string
  /** The „Miből jött össze" strip prints its own visible caption beside each ring and repeats
   *  what the tiles below already announce — there the ring is decoration, not a second voice. */
  decorative?: boolean
  className?: string
}) {
  const style = { '--c': scoreBandColor(score), '--v': score ?? 0 } as CSSProperties
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': `${label} · ${score == null ? 'nincs pontszám' : `${score} / 100`}` }
  return (
    <div className={cn('dayev-sring', score == null && 'is-dash', className)} style={style} {...a11y}>
      <i>{score ?? '—'}</i>
    </div>
  )
}

export function DayDimensionTile({ dimension, delayMs, dayOpen, children }: {
  dimension: NormalizedDayDimension
  delayMs: number
  /** The DAY is still running (`in_progress`) — a closed dimension then wears a „kész" tag
   *  rather than its weight, because the weight only means something once the day is scored. */
  dayOpen?: boolean
  /** Extra graphics under the header — the prototype draws the nutrition tile's kcal / protein
   *  / `c · f` goal bars here rather than in a card of their own. */
  children?: ReactNode
}) {
  const closed = dimension.status === 'DONE'
  return (
    <section
      className={cn('dayev-dim rise', closed ? `is-${dimension.id}` : 'is-ghost')}
      style={{ '--d': `${delayMs}ms` } as CSSProperties}
    >
      <div className="dayev-dimhead">
        <span className="dayev-pic"><ClayIcon name={DIMENSION_ICON[dimension.id]} size={22} /></span>
        <div className="dayev-dimname">
          <div className="dayev-dnm">{dimension.label}</div>
          {closed && !dayOpen ? (
            // The renormalised weight — a degraded dimension carries 0 and is not shown at all.
            <div className="mz-eyebrow dayev-dwt">súly {Math.round(dimension.weight * 100)}%</div>
          ) : (
            <div className="dayev-dwt">
              <span className={cn('dayev-stag', closed && 'is-done')}>{STATUS_TAG[dimension.status]}</span>
            </div>
          )}
        </div>
        <DayDimRing score={dimension.score} label={dimension.label} />
      </div>
      {children}
      {dimension.facts.length > 0 && (
        <div className="dayev-fchips">
          {dimension.facts.map((f) => (
            <span key={`${f.label}·${f.value}`} className="dayev-fchip">{f.label} · {f.value}</span>
          ))}
        </div>
      )}
      {dimension.note != null && <p className={cn('dayev-why', !closed && 'is-mut')}>{dimension.note}</p>}
    </section>
  )
}
