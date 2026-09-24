// Üveg (mezo-me75u.6): one glass sky card — the moving average glows sky, the raw line is
// faint, the plan is a dashed sage line in its sage tolerance band, the last point a glowing
// dot; too few points is the dashed empty state. CSS: `── uveg en suly (`.
import type { WeightEntry } from '@/data/types'
import type { GoalResponse } from '@/data/me/goalApi'
import { huMonthDay } from '@/shared/lib/dates'
import { periodWindow, sliceByPeriod, movingAverage, planTrajectory, daysBetween, isoMinusDays, type Period } from '@/features/me/logic/weightStats'

const W = 360, H = 172
const PX0 = 34, PX1 = 352, PY0 = 12, PY1 = 128

const path = (p: { x: number; y: number }[]): string =>
  p.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ')

export function WeightTrendChart({ log, goalResponse, period }: {
  log: WeightEntry[]
  goalResponse: GoalResponse | null
  period: Period
}) {
  const win = periodWindow(log, period)
  const data = sliceByPeriod(log, period)
  if (!win || data.length < 2) {
    return (
      <div className="wt-chart wt-chart-empty uv-empty">
        <span className="wt-chart-emptytx">Kevés mérés ehhez az ablakhoz</span>
      </div>
    )
  }
  const plan = planTrajectory(goalResponse, win.startIso, win.endIso)
  const totalDays = Math.max(1, daysBetween(win.startIso, win.endIso))
  const xForIso = (iso: string): number => PX0 + (daysBetween(win.startIso, iso) / totalDays) * (PX1 - PX0)

  const ys: number[] = data.map(d => d.value)
  if (plan) for (const p of plan.plan) ys.push(p.kg + plan.tolKg, p.kg - plan.tolKg)
  let minV = Math.min(...ys) - 0.5
  let maxV = Math.max(...ys) + 0.5
  if (maxV - minV < 1) { maxV += 0.5; minV -= 0.5 }
  const yFor = (v: number): number => PY0 + (1 - (v - minV) / (maxV - minV)) * (PY1 - PY0)

  const pts = data.map(d => ({ x: xForIso(d.date), y: yFor(d.value) }))
  const ma = movingAverage(data.map(d => d.value))
  const maPts = data.map((d, i) => ({ x: xForIso(d.date), y: yFor(ma[i]) }))
  const areaPath = `${path(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${PY1} L ${pts[0].x.toFixed(1)} ${PY1} Z`

  let bandPath = '', planPath = ''
  if (plan) {
    const up = plan.plan.map(p => ({ x: xForIso(p.iso), y: yFor(p.kg + plan.tolKg) }))
    const dn = plan.plan.map(p => ({ x: xForIso(p.iso), y: yFor(p.kg - plan.tolKg) })).reverse()
    bandPath = `${path(up)} ${dn.map(q => `L${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ')} Z`
    planPath = path(plan.plan.map(p => ({ x: xForIso(p.iso), y: yFor(p.kg) })))
  }

  const yTicks = [maxV - 0.5, (maxV + minV) / 2, minV + 0.5].map(v => ({ label: (Math.round(v * 10) / 10).toString(), y: yFor(v) }))
  const midIso = isoMinusDays(win.endIso, Math.floor(totalDays / 2))
  const xLabels = [{ iso: win.startIso, x: PX0 }, { iso: midIso, x: xForIso(midIso) }, { iso: win.endIso, x: PX1 }]
  const last = pts[pts.length - 1]
  const lastVal = data[data.length - 1].value

  return (
    <div className="wt-chart glass">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="wtc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dv-sky)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--dv-sky)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PX0} x2={PX1} y1={t.y} y2={t.y} stroke="var(--divider)" strokeDasharray="3 4" />
            <text x={PX0 - 4} y={t.y + 3} fontSize="9" fill="var(--text-muted)" textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>{t.label}</text>
          </g>
        ))}

        {plan && <path className="wtc-band" d={bandPath} fill="color-mix(in srgb, var(--dv-sage) 13%, transparent)" />}
        {plan && <path className="wtc-plan" d={planPath} fill="none" stroke="var(--dv-sage)" strokeWidth="1.6" strokeDasharray="5 4" />}

        <path d={areaPath} fill="url(#wtc-area)" />
        <path className="wtc-raw" d={path(pts)} fill="none" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.28" strokeLinejoin="round" />
        <path className="wtc-ma" d={path(maPts)} fill="none" stroke="var(--dv-sky)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />

        <circle className="wtc-dot" cx={last.x} cy={last.y} r="5" fill="var(--dv-sky)" />
        <text x={last.x - 8} y={last.y - 8} fontSize="11" fontWeight="600" fill="var(--text-primary)" textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>{lastVal.toFixed(1)}</text>

        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 8} fontSize="9" fill="var(--text-muted)"
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}>{huMonthDay(l.iso)}</text>
        ))}
      </svg>

      <div className="wt-leg">
        <span><i className="is-actual" /> tényleges</span>
        {plan && <span><i className="is-plan" /> terv</span>}
        {plan && <span><i className="is-band" /> tűréssáv</span>}
      </div>
    </div>
  )
}
