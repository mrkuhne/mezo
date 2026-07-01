import type { WeightEntry } from '@/data/types'
import type { GoalResponse } from '@/data/me/goalApi'
import { huMonthDay } from '@/shared/lib/dates'
import { periodWindow, sliceByPeriod, movingAverage, planTrajectory, daysBetween, isoMinusDays, type Period } from '@/features/me/components/weightStats'

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
      <div className="card notch-12" style={{ padding: 24, textAlign: 'center' }}>
        <span className="label-mono" style={{ color: 'var(--text-tertiary)' }}>Kevés mérés ehhez az ablakhoz</span>
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
    <div className="card notch-12" style={{ padding: '14px 12px 10px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="wtc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-glow)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-glow)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PX0} x2={PX1} y1={t.y} y2={t.y} stroke="var(--border-subtle)" strokeDasharray="3 4" />
            <text x={PX0 - 4} y={t.y + 3} fontFamily="var(--ff-mono)" fontSize="9" fill="var(--text-tertiary)" textAnchor="end">{t.label}</text>
          </g>
        ))}

        {plan && <path d={bandPath} fill="color-mix(in srgb, var(--warning) 14%, transparent)" />}
        {plan && <path d={planPath} fill="none" stroke="var(--warning)" strokeWidth="1.6" strokeDasharray="5 4" />}

        <path d={areaPath} fill="url(#wtc-area)" />
        <path d={path(pts)} fill="none" stroke="var(--brand-glow)" strokeWidth="1" opacity="0.4" strokeLinejoin="round" />
        <path d={path(maPts)} fill="none" stroke="var(--brand-glow)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 5px var(--brand-glow))' }} />

        <circle cx={last.x} cy={last.y} r="4.5" fill="var(--brand-glow)" stroke="var(--canvas)" strokeWidth="2" />
        <text x={last.x - 8} y={last.y - 8} fontFamily="var(--ff-mono)" fontSize="11" fontWeight="600" fill="var(--brand-glow)" textAnchor="end">{lastVal.toFixed(1)}</text>

        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 8} fontFamily="var(--ff-mono)" fontSize="9" fill="var(--text-tertiary)"
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}>{huMonthDay(l.iso)}</text>
        ))}
      </svg>

      <div className="row gap-md" style={{ marginTop: 6, flexWrap: 'wrap', fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
        <span className="row" style={{ gap: 5 }}><i style={{ width: 14, borderTop: '2px solid var(--brand-glow)' }} /> tényleges</span>
        {plan && <span className="row" style={{ gap: 5 }}><i style={{ width: 14, borderTop: '2px dashed var(--warning)' }} /> terv</span>}
        {plan && <span className="row" style={{ gap: 5 }}><i style={{ width: 14, height: 10, background: 'color-mix(in srgb, var(--warning) 18%, transparent)', borderRadius: 2 }} /> tűréssáv</span>}
      </div>
    </div>
  )
}
