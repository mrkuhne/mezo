import { useState } from 'react'
import type { ExpenditureWeek } from '@/data/fuel/expenditureApi'
import { huInt } from '@/shared/lib/huNum'
import { addDays } from '@/shared/lib/dates'
import { huShortDate, huWeekRange, round10, signed } from '@/features/fuel/sheets/learnedBaseFormat'

// ============================================================
// Mezo · LearningHistoryChart — „Hétről hétre” (mezo-3n2so, learned expenditure part 2, spec §6.3).
// Build target: docs/design_2.0/prototypes/elo/fuel.html `weekChart()` / `weekDetail()` (same
// 320×176 viewBox, margins, strokes and legend). One x scale (a CONTINUOUS weekly axis from the
// first to the last reviewed week) and one y scale (kcal) for everything:
//   the formula      — dashed muted line
//   the frame's base — the accent (sage) line, glowing; a hollow marker on a week that held
//   the posterior    — a low-opacity sage band, posterior ± σ̂
// HONESTY: a calendar week without a row is a GAP — both lines and the band break there, the
// column says „nincs adat”, and selecting it shows no number at all (never an interpolation).
// Tap targets are an HTML overlay of one button per calendar week (a role="img" chart hides its
// children from assistive tech). The applied line draws once (CSS, pathLength=1); reduced motion
// skips the draw.
// ============================================================

const W = 320
const H = 176
const L = 34
const R = 8
const T = 12
const B = 26
const PLOT_H = H - T - B

/** A week that held needs at least this much data (spec §4; the card carries the live values). */
const MIN_USABLE_DAYS = 4
const MIN_WEIGH_IN_DAYS = 2

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const weekEnd = (start: string) => addDays(start, 6)
const rangeOf = (start: string) => huWeekRange(start, weekEnd(start))

/** Every calendar week from the first row to the last; `null` = no row for that week (a gap). */
function calendarWeeks(weeks: ExpenditureWeek[]): Array<{ start: string; row: ExpenditureWeek | null }> {
  if (weeks.length === 0) return []
  const byStart = new Map(weeks.map(w => [w.weekStart, w]))
  const last = weeks[weeks.length - 1].weekStart
  const out: Array<{ start: string; row: ExpenditureWeek | null }> = []
  for (let s = weeks[0].weekStart; s <= last; s = addDays(s, 7)) out.push({ start: s, row: byStart.get(s) ?? null })
  return out
}

/** Contiguous runs of weeks that have a row — each run is its own path, so a gap breaks it. */
function runs<T>(slots: Array<T | null>): Array<Array<{ i: number; v: T }>> {
  const out: Array<Array<{ i: number; v: T }>> = []
  let cur: Array<{ i: number; v: T }> = []
  slots.forEach((v, i) => {
    if (v == null) { if (cur.length) out.push(cur); cur = []; return }
    cur.push({ i, v })
  })
  if (cur.length) out.push(cur)
  return out
}

export function LearningHistoryChart({ weeks, reducedMotion }: {
  weeks: ExpenditureWeek[]
  /** Test seam; defaults to `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}) {
  const [reduce] = useState(() => reducedMotion ?? prefersReducedMotion())
  const cal = calendarWeeks(weeks)
  const n = cal.length
  const [sel, setSel] = useState(n - 1)
  if (n === 0) return null
  const selected = Math.min(Math.max(sel, 0), n - 1)

  const rows = cal.map(c => c.row)
  const values = weeks.flatMap(w => [w.formulaBaseKcal, w.appliedBaseKcal, w.posteriorBaseKcal - w.posteriorSdKcal, w.posteriorBaseKcal + w.posteriorSdKcal])
  const lo = Math.floor((Math.min(...values) - 30) / 100) * 100
  const hi = Math.max(lo + 200, Math.ceil((Math.max(...values) + 30) / 100) * 100)
  const step = hi - lo > 600 ? 200 : 100
  const grid: number[] = []
  for (let v = Math.ceil((lo + 1) / step) * step; v < hi; v += step) grid.push(v)

  const colW = (W - L - R) / n
  const x = (i: number) => L + colW * (i + 0.5)
  const y = (v: number) => T + PLOT_H * (1 - (v - lo) / (hi - lo))
  const p = (n1: number) => n1.toFixed(1)
  const line = (run: Array<{ i: number; v: ExpenditureWeek }>, get: (w: ExpenditureWeek) => number) =>
    run.map(({ i, v }, k) => `${k ? 'L' : 'M'}${p(x(i))} ${p(y(get(v)))}`).join('')
  const band = (run: Array<{ i: number; v: ExpenditureWeek }>) =>
    `${line(run, w => w.posteriorBaseKcal + w.posteriorSdKcal)}${[...run].reverse().map(({ i, v }) => `L${p(x(i))} ${p(y(v.posteriorBaseKcal - v.posteriorSdKcal))}`).join('')}Z`
  const segs = runs(rows)
  const xLabels = cal.map((_, i) => i).filter(i => i === n - 1 || (i % 4 === 0 && n - 1 - i >= 2))

  return (
    <>
      <div className="fln-chart-wrap">
        <svg
          className={`fln-chart${reduce ? '' : ' is-draw'}`}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`A keret alapja hétről hétre, ${n} hét: szaggatott a képlet, folytonos a tanult keret-alap, körülötte a bizonytalanság sávja`}
        >
          {grid.map(v => (
            <g key={v}>
              <line className="fln-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
              <text className="fln-ax" x={L - 6} y={y(v) + 3} textAnchor="end">{v}</text>
            </g>
          ))}
          {segs.map(run => <path key={`b${run[0].i}`} className="fln-band" d={band(run)} />)}
          {cal.map((c, i) => c.row ? null : (
            <g key={`gap${i}`} className="fln-gap">
              <rect x={p(x(i) - 9)} y={T} width={18} height={PLOT_H} rx={6} />
              <text x={p(x(i))} y={T + PLOT_H / 2} textAnchor="middle" transform={`rotate(-90 ${p(x(i))} ${T + PLOT_H / 2})`}>nincs adat</text>
            </g>
          ))}
          <line className="fln-sel" x1={p(x(selected))} x2={p(x(selected))} y1={T} y2={H - B} />
          {segs.map(run => <path key={`f${run[0].i}`} className="fln-formula" d={line(run, w => w.formulaBaseKcal)} />)}
          {segs.map(run => <path key={`a${run[0].i}`} className="fln-applied" pathLength={1} d={line(run, w => w.appliedBaseKcal)} />)}
          {rows.map((r, i) => r && (
            <circle
              key={`d${i}`}
              className={`fln-dot${r.status === 'holding' ? ' is-hold' : ''}${i === selected ? ' is-sel' : ''}`}
              cx={p(x(i))}
              cy={p(y(r.appliedBaseKcal))}
              r={i === selected ? 5 : 3.6}
            />
          ))}
          {xLabels.map(i => (
            <text key={`x${i}`} className="fln-ax" x={p(x(i))} y={H - 8} textAnchor="middle">{huShortDate(cal[i].start)}</text>
          ))}
        </svg>
        <div className="fln-hits" style={{ left: `${(L / W) * 100}%`, right: `${(R / W) * 100}%` }}>
          {cal.map((c, i) => (
            <button
              key={c.start}
              type="button"
              className="fln-hit"
              aria-label={rangeOf(c.start)}
              aria-pressed={i === selected}
              onClick={() => setSel(i)}
            />
          ))}
        </div>
      </div>

      <div className="fln-legend">
        <span><i className="ln is-formula" />képlet</span>
        <span><i className="ln is-applied" />a keret alapja</span>
        <span><i className="is-band" />bizonytalanság (±)</span>
        <span><i className="is-hold" />vártam</span>
      </div>
      <p className="fln-fine">Koppints egy hétre a számaiért. Ahol nincs sor, ott a vonal megszakad — nem töltöm ki.</p>

      <WeekDetail start={cal[selected].start} row={cal[selected].row} />
    </>
  )
}

function WeekDetail({ start, row }: { start: string; row: ExpenditureWeek | null }) {
  if (!row) {
    return (
      <div className="fln-wkd" aria-live="polite">
        <strong>{rangeOf(start)}</strong>
        <p>Erről a hétről nincs sorom — kevés volt a felírás és a mérlegelés, ezért nem tippelek számot.</p>
      </div>
    )
  }
  const hold = row.status === 'holding'
  const cells: Array<[string, string]> = [
    ['Képlet szerint', `${huInt(row.formulaBaseKcal)} kcal`],
    ['Tanult', `${huInt(row.posteriorBaseKcal)} ± ${round10(row.posteriorSdKcal)} kcal`],
    ['A keret alapja', `${huInt(row.appliedBaseKcal)} kcal`],
    ['Lépés', hold || row.stepKcal === 0 ? 'nem léptem' : `${signed(row.stepKcal)} kcal`],
    ['Teljes nap', String(row.usableDays)],
    ['Mérlegelés', String(row.weighInDays)],
  ]
  return (
    <div className="fln-wkd" aria-live="polite">
      <strong>{rangeOf(start)}{hold ? ' · ezen a héten vártam' : ''}</strong>
      <div className="fln-kv">
        {cells.map(([k, v]) => (
          <div key={k} className="fln-kv-cell"><small>{k}</small><b>{v}</b></div>
        ))}
      </div>
      {hold && (
        <p>Kevés adat volt (legalább {MIN_USABLE_DAYS} teljes nap és {MIN_WEIGH_IN_DAYS} mérlegelés kell), ezért a keret nem mozdult.</p>
      )}
    </div>
  )
}
