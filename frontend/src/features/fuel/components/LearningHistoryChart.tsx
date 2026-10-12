import { useState } from 'react'
import type { ExpenditureWeek } from '@/data/fuel/expenditureApi'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { addDays } from '@/shared/lib/dates'
import { Lab, Note } from '@/shared/ui/folyadek'
import { Kv, Lgd } from '@/features/fuel/components/folyadek'
import { huShortDate, huWeekRange, round10, signed } from '@/features/fuel/sheets/learnedBaseFormat'

// ============================================================
// Mezo · LearningHistoryChart — „Hétről hétre” (mezo-3n2so, learned expenditure part 2, spec §6.3).
// Folyadék (mezo-n4wf5.5): build target docs/design_2.0/prototypes/vilagos/fuel.js `learnSvg()` and
// the label + `kv` + note under it (336×160 viewBox, the prototype's margins and marks). One x scale
// (a CONTINUOUS weekly axis from the first to the last reviewed week) and one y scale (kcal):
//   the formula      — thin dashed line
//   the frame's base — the domain line; a hollow ring on a week that held, the selected week ringed
//   the posterior    — a faint band, posterior ± σ̂
// HONESTY: a calendar week without a row is a GAP — both lines and the band break there, the
// column says „nincs adat”, and selecting it shows no number at all (never an interpolation).
// Tap targets are an HTML overlay of one button per calendar week (a role="img" chart hides its
// children from assistive tech); the selected week's numbers stand under the chart (the prototype
// shows them in a toast — the live selection is kept, behaviour frozen). The base line draws once
// (CSS, pathLength=1); reduced motion skips the draw.
// ============================================================

const W = 336
const H = 160
const L = 30
const R = 8
const T = 10
const B = 24
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
function runs<V>(slots: Array<V | null>): Array<Array<{ i: number; v: V }>> {
  const out: Array<Array<{ i: number; v: V }>> = []
  let cur: Array<{ i: number; v: V }> = []
  slots.forEach((v, i) => {
    if (v == null) { if (cur.length) out.push(cur); cur = []; return }
    cur.push({ i, v })
  })
  if (cur.length) out.push(cur)
  return out
}

const p = (n: number) => n.toFixed(1)
/** The prototype's soft curve through the points (`smooth`). */
function smooth(pts: Array<[number, number]>): string {
  return pts.map((pt, i) => {
    if (!i) return `M${p(pt[0])} ${p(pt[1])}`
    const a = pts[i - 2] ?? pts[i - 1]
    const b = pts[i - 1]
    const d = pts[i + 1] ?? pt
    return `C${p(b[0] + (pt[0] - a[0]) / 6)} ${p(b[1] + (pt[1] - a[1]) / 6)} ${p(pt[0] - (d[0] - b[0]) / 6)} ${p(pt[1] - (d[1] - b[1]) / 6)} ${p(pt[0])} ${p(pt[1])}`
  }).join('')
}

export function LearningHistoryChart({ weeks, reducedMotion }: {
  weeks: ExpenditureWeek[]
  /** Test seam; defaults to `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}) {
  const M = useM()
  const C = M.fuelTanulas.chart
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
  const line = (run: Array<{ i: number; v: ExpenditureWeek }>, get: (w: ExpenditureWeek) => number) =>
    smooth(run.map(({ i, v }) => [x(i), y(get(v))]))
  const band = (run: Array<{ i: number; v: ExpenditureWeek }>) =>
    `${run.map(({ i, v }, k) => `${k ? 'L' : 'M'}${p(x(i))} ${p(y(v.posteriorBaseKcal + v.posteriorSdKcal))}`).join('')}${[...run].reverse().map(({ i, v }) => `L${p(x(i))} ${p(y(v.posteriorBaseKcal - v.posteriorSdKcal))}`).join('')}Z`
  const segs = runs(rows)
  const xLabels = cal.map((_, i) => i).filter(i => i === n - 1 || (i % 4 === 0 && n - 1 - i >= 2))
  const midY = T + PLOT_H / 2

  return (
    <>
      <div className="ft-chart-wrap">
        <svg className={`ft-chart ft-weeks${reduce ? '' : ' is-draw'}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={C.aria(n)}>
          {grid.map(v => (
            <g key={v}>
              <line className="grid" x1={L} x2={W - R} y1={p(y(v))} y2={p(y(v))} />
              <text x={L - 4} y={p(y(v) + 3.5)} textAnchor="end">{v}</text>
            </g>
          ))}
          {segs.map(run => <path key={`b${run[0].i}`} className="band" d={band(run)} />)}
          {cal.map((c, i) => c.row ? null : (
            <g key={`gap${i}`}>
              <rect className="gap" x={p(x(i) - 8)} y={T} width={16} height={PLOT_H} rx={8} />
              <text x={p(x(i))} y={midY} textAnchor="middle" transform={`rotate(-90 ${p(x(i))} ${midY})`}>{C.noData}</text>
            </g>
          ))}
          {segs.map(run => <path key={`f${run[0].i}`} className="formula" d={line(run, w => w.formulaBaseKcal)} />)}
          {segs.map(run => <path key={`a${run[0].i}`} className="applied" pathLength={1} d={line(run, w => w.appliedBaseKcal)} />)}
          {rows.map((r, i) => r && (
            <circle
              key={`d${i}`}
              className={`dot ${i === selected ? 'sel' : r.status === 'holding' ? 'hold' : 'raw'}${r.status === 'holding' ? ' is-hold' : ''}`}
              cx={p(x(i))}
              cy={p(y(r.appliedBaseKcal))}
              r={i === selected ? 4.5 : 3}
            />
          ))}
          {xLabels.map(i => (
            <text key={`x${i}`} x={p(x(i))} y={H - 5} textAnchor="middle">{M.fuelTanulas.shortDay(huShortDate(cal[i].start))}</text>
          ))}
        </svg>
        <div className="ft-hits" style={{ left: `${(L / W) * 100}%`, right: `${(R / W) * 100}%` }}>
          {cal.map((c, i) => (
            <button key={c.start} type="button" aria-label={rangeOf(c.start)} aria-pressed={i === selected} onClick={() => setSel(i)} />
          ))}
        </div>
      </div>

      <Lgd items={[['dash', C.legendFormula], ['liq', C.legendBase], ['band', C.legendBand], ['ring', C.legendHeld]]} />
      <Note>{C.hint}</Note>

      <WeekDetail start={cal[selected].start} row={cal[selected].row} />
    </>
  )
}

function WeekDetail({ start, row }: { start: string; row: ExpenditureWeek | null }) {
  const C = useM().fuelTanulas.chart
  if (!row) {
    return (
      <div className="ft-wkd" aria-live="polite">
        <Lab>{rangeOf(start)}</Lab>
        <Note>{C.gap}</Note>
      </div>
    )
  }
  const hold = row.status === 'holding'
  return (
    <div className="ft-wkd" aria-live="polite">
      <Lab>{hold ? C.weekHeld(rangeOf(start)) : rangeOf(start)}</Lab>
      <Kv items={[
        [C.formula, C.kcal(fmtGrouped(row.formulaBaseKcal))],
        [C.learned, C.learnedValue(fmtGrouped(row.posteriorBaseKcal), String(round10(row.posteriorSdKcal)))],
        [C.base, C.kcal(fmtGrouped(row.appliedBaseKcal))],
        [C.step, hold || row.stepKcal === 0 ? C.noStep : C.kcal(signed(row.stepKcal))],
        [C.days, String(row.usableDays)],
        [C.weighIns, String(row.weighInDays)],
      ]} />
      {hold && <Note>{C.heldNote(MIN_USABLE_DAYS, MIN_WEIGH_IN_DAYS)}</Note>}
    </div>
  )
}
