// A napom · one dimension as a banded row (prototype uveg-napod-body.html layout 2,
// `dimsToday()` / `dimsClosed()`, owner OK 2026-09-24). A lit well with the dimension's 3D
// icon, the label, the facts on one ellipsised line, a glowing bar and the end value.
//   today   — a status word (KÉSZ / ÚTON / NYITVA), no weight; not interactive.
//   scored  — a `<button aria-expanded>`: tap opens the fact chips and the Mezo's note.
//   plain   — a thin/empty closed day: value only, no status word, no bar.
//   loading — a dashed placeholder, nothing claimed.
// A row with no score (NO_DATA, or still open) is dashed free space, not glass (bible U1 rule 6).
import { useState, type CSSProperties } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { DAY_DIMENSIONS, type DayDimensionKey } from '@/features/me/logic/weekDay'
import type { DimensionStatus, NormalizedDayDimension } from '@/data/me/dayEvaluation'

const LOOK: Record<DayDimensionKey, { icon: Icon3DName; color: string }> = {
  nutrition: { icon: 't-bowl', color: 'var(--dv-sage)' },
  quality: { icon: 't-sprout', color: 'var(--dv-amber)' },
  training: { icon: 't-dumbbell', color: 'var(--dv-coral)' },
  sleep: { icon: 't-sleep', color: 'var(--dv-lav)' },
  logging: { icon: 't-checkin', color: 'var(--dv-sky)' },
  rhythm: { icon: 't-chain', color: 'var(--dv-rose)' },
}

/** The six dimensions in `DAY_DIMENSIONS` order with the page's label, icon and colour. The
 *  label is the shared lower-case one capitalised (Tápanyag, Logolás…) — the wire's own labels
 *  (Táplálkozás, Naplózás) are the engine's vocabulary, the prototype speaks the week's. */
export const NAPOM_DIMENSIONS = DAY_DIMENSIONS.map((d) => ({
  key: d.key,
  label: d.label.charAt(0).toUpperCase() + d.label.slice(1),
  ...LOOK[d.key],
}))

const TODAY_WORD: Record<DimensionStatus, string> = { DONE: 'KÉSZ', IN_PROGRESS: 'ÚTON', NO_DATA: 'NYITVA' }

export type NapomRowMode = 'today' | 'scored' | 'plain' | 'loading'

export function NapomDimensionRow({ dimension, mode, goalTick = false, i }: {
  dimension: NormalizedDayDimension
  mode: NapomRowMode
  /** Nutrition only, when the day has a kcal target: the goal tick at the bar's end. */
  goalTick?: boolean
  /** Entrance stagger index. */
  i: number
}) {
  const [open, setOpen] = useState(false)
  const meta = NAPOM_DIMENSIONS.find((d) => d.key === dimension.id) ?? NAPOM_DIMENSIONS[0]
  const { score, status, facts, note } = dimension
  const dashed = mode === 'loading' || score == null
  const factLine = mode === 'loading'
    ? ''
    : facts.length > 0
      ? facts.map((f) => `${f.label} ${f.value}`).join(' · ')
      : status === 'NO_DATA' ? 'nincs adat' : ''
  // An open (NYITVA / nincs adat) row is free space: no bar, no goal tick (prototype `.drow.open`).
  const showBar = !dashed && (mode === 'today' || mode === 'scored')
  const word = mode === 'today' ? TODAY_WORD[status] : mode === 'scored' ? (open ? 'BEZÁR' : 'MEZO ›') : null

  const body = (
    <>
      <span className="napom-well"><Icon3D name={meta.icon} size={32} /></span>
      <span className="napom-mid">
        <strong>
          {meta.label}
          {mode === 'scored' && <em className="napom-wt"> súly {Math.round(dimension.weight * 100)}%</em>}
        </strong>
        <small>{factLine}</small>
        {showBar && (
          <span className="napom-bar uv-bar">
            <b style={{ '--w': `${Math.max(2, Math.min(100, score ?? 0))}%` } as CSSProperties} />
            {goalTick && <u style={{ '--g': '100%' } as CSSProperties} />}
          </span>
        )}
      </span>
      <span className="napom-end">
        <b>{mode === 'loading' ? '' : (score ?? '–')}</b>
        {word && <span className={cn('napom-st', mode === 'today' && status === 'DONE' && 'is-ok')}>{word}</span>}
      </span>
      {open && (
        <span className="napom-dmore">
          {facts.length > 0 && (
            <span className="napom-dchips">
              {facts.map((f) => <span key={`${f.label}·${f.value}`} className="napom-flat">{f.label} · {f.value}</span>)}
            </span>
          )}
          {note && <span className="napom-dnote">{note}</span>}
        </span>
      )}
    </>
  )

  const className = cn('napom-drow rise', dashed ? 'is-open' : 'glass', open && 'is-expanded')
  const style = { '--c': meta.color, '--i': i } as CSSProperties
  if (mode !== 'scored') return <div className={className} style={style}>{body}</div>
  return (
    <button type="button" className={className} style={style} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
      {body}
    </button>
  )
}
