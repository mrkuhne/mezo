// A napom · one dimension as a kit row (Folyadék prototype `ndDayBody`, vilagos/nap.js): the
// dimension's glyph in its chip, the label, the facts on one line, a level and the end value.
//   today   — a status pill next to the label (kész / úton / nyitva), no weight; not interactive,
//             its fact chips (and a note, if the Mezo left one) always shown (owner 2026-09-26,
//             mezo-7izrx). The level's colour is the state: done, open, or on the way.
//   scored  — a row with a toggle `<button aria-expanded>` that covers the whole row, OPEN by
//             default (owner 2026-09-26, mezo-7izrx): the fact chips and the Mezo's note show up
//             front; a tap folds them away.
//   plain   — a thin/empty closed day: value only, no status word.
//   loading — a dimmed placeholder, nothing claimed.
// A row with no score on a closed day is dimmed, never a fabricated 0.
import { Fragment, useId, useState } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { Chips, Level, Row, St } from '@/shared/ui/folyadek'
import { DAY_DIMENSIONS, type DayDimensionKey } from '@/features/me/logic/weekDay'
import type { DimensionStatus, NormalizedDayDimension } from '@/data/me/dayEvaluation'

const ICON: Record<DayDimensionKey, Icon3DName> = {
  nutrition: 't-bowl',
  quality: 't-sprout',
  training: 't-dumbbell',
  sleep: 't-sleep',
  logging: 't-checkin',
  rhythm: 't-chain',
}

/** The six dimensions in `DAY_DIMENSIONS` order with the page's label and icon. The label is the
 *  shared lower-case one capitalised (Tápanyag, Logolás…) — the wire's own labels (Táplálkozás,
 *  Naplózás) are the engine's vocabulary, the prototype speaks the week's. */
export const NAPOM_DIMENSIONS = DAY_DIMENSIONS.map((d) => ({
  key: d.key,
  label: d.label.charAt(0).toUpperCase() + d.label.slice(1),
  icon: ICON[d.key],
}))

const TODAY_WORD: Record<DimensionStatus, { word: string; tone: 'ok' | 'q' | 'warn'; color: string }> = {
  DONE: { word: 'kész', tone: 'ok', color: 'var(--fo-ok)' },
  IN_PROGRESS: { word: 'úton', tone: 'q', color: 'var(--dom)' },
  NO_DATA: { word: 'nyitva', tone: 'warn', color: 'var(--fo-warn)' },
}

export type NapomRowMode = 'today' | 'scored' | 'plain' | 'loading'

/** The row's one-line fact summary (`kcal 2980 / 3100 · fehérje 205 / 220 g`, or `nincs adat`).
 *  Exported so the page's live-pulse snapshot compares exactly the line the reader sees. */
export function factLineOf(dimension: NormalizedDayDimension, mode: NapomRowMode): string {
  if (mode === 'loading') return ''
  if (dimension.facts.length > 0) return dimension.facts.map((f) => `${f.label} ${f.value}`).join(' · ')
  return dimension.status === 'NO_DATA' ? 'nincs adat' : ''
}

/** A fact value as drawn. The engine sends a done yes/no fact (víz) as the `✓` glyph; the page
 *  draws it as the tick glyph with a spoken word. Every other value is text. */
function FactValue({ value }: { value: string }) {
  if (value !== '✓') return <>{value}</>
  return <><Icon3D name="t-tick" size={14} className="nn-tick" /><span className="sr-only">megvan</span></>
}

export function NapomDimensionRow({ dimension, mode, goalTick = false, fresh = false }: {
  dimension: NormalizedDayDimension
  mode: NapomRowMode
  /** Nutrition only, when the day has a kcal target: the goal mark at the level's end. */
  goalTick?: boolean
  /** Today's value just changed on a live refetch: play the one-shot highlight (mezo-yjzhw.6). */
  fresh?: boolean
}) {
  const [open, setOpen] = useState(true)
  const factId = useId()
  const meta = NAPOM_DIMENSIONS.find((d) => d.key === dimension.id) ?? NAPOM_DIMENSIONS[0]
  const { score, status, facts, note } = dimension
  const loading = mode === 'loading'
  const factLine = factLineOf(dimension, mode)
  // The detail block: always on a live day, the tap-to-fold state on a scored one — and only
  // when there is something to show (a no-data row must not grow an empty box).
  const detailed = (mode === 'today' || (mode === 'scored' && open)) && (facts.length > 0 || note != null)
  const today = mode === 'today' ? TODAY_WORD[status] : null
  // Colour = state: today by status; a closed day turns to the "done" colour from 80 up.
  const color = today ? today.color : score != null && score >= 80 ? 'var(--fo-ok)' : 'var(--dom)'
  const pct = loading || score == null ? 0 : mode === 'today' ? Math.max(2, score) : score

  const title = (
    <>
      {meta.label}
      {today && <> <St tone={today.tone} className="nn-stt">{today.word}</St></>}
      {mode === 'scored' && <span className="nn-w"> súly {Math.round(dimension.weight * 100)}%</span>}
    </>
  )
  const sub = loading
    ? 'betöltés…'
    : (
      <span id={factId}>
        {facts.some((f) => f.value === '✓')
          ? facts.map((f, k) => <Fragment key={`${f.label}·${f.value}`}>{k > 0 && ' · '}{f.label} <FactValue value={f.value} /></Fragment>)
          : factLine}
      </span>
    )
  const more = (
    <>
      <span className="nn-lv">
        <Level pct={pct} height={12} color={color} />
        {goalTick && !loading && score != null && <i className="nn-goal" aria-hidden="true" />}
      </span>
      {detailed && (
        <span className="nn-open">
          {facts.length > 0 && (
            <Chips items={facts.map((f) => <Fragment key={`${f.label}·${f.value}`}>{f.label} · <FactValue value={f.value} /></Fragment>)} />
          )}
          {note && <span className="nn-dnote">{note}</span>}
        </span>
      )}
    </>
  )

  return (
    <Row
      className={cn('nn-drow', fresh && 'is-fresh', detailed && 'is-expanded')}
      state={loading || (score == null && mode !== 'today') ? 'dim' : undefined}
      icon={meta.icon}
      title={title}
      sub={sub}
      value={loading ? '–' : (score ?? '–')}
      more={more}
      right={mode === 'scored' ? (
        // The toggle's hit area is the whole row (`::after`, see the stylesheet). The name is the
        // label and the score; the fact line is the description — the whole body (weight, level,
        // open chips) is too much to announce as a name (mezo-yjzhw.7).
        <button
          type="button"
          className="nn-tg"
          aria-expanded={open}
          aria-label={`${meta.label}, ${score == null ? 'nincs adat' : `${score} pont`}`}
          // A no-data row's fact line is just "nincs adat", which the name already says — no echo.
          aria-describedby={factLine && !(score == null && facts.length === 0) ? factId : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'bezár' : 'Mezo ›'}
        </button>
      ) : undefined}
    />
  )
}
