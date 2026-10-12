import { useEffect, useState } from 'react'
import type { ExpenditureSeriesPoint } from '@/data/fuel/expenditureApi'
import { useM } from '@/shared/i18n'
import { huShortDate } from '@/features/fuel/sheets/learnedBaseFormat'

// „Hogy tanultam?” step 2 (mezo-y72o3). Folyadék (mezo-n4wf5.5): build target fuel.js `howSvg()` —
// intake bars (counts = the domain liquid, suspicious / marked = amber, unlogged = none), weigh-in
// points, the trend line (domain) and the water band between trend and tissue (water blue). Colours
// are in styles/folyadek-fuel-tanulas.css (`.ft-how`). One-shot rAF draw-in on mount; reduced
// motion = the final frame.

const W = 320
const H = 150
const TOP = 8
const WEIGHT_H = 60
const BAR_H = 70
const BAR_BASE = H - 14
const DUR = 900

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const ease = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export function LearnedBaseChart({ series, historyWeeks, reducedMotion }: {
  series: ExpenditureSeriesPoint[]
  /** The explanation's own week count — the chart's aria-label reports this, not a guess from `series.length`. */
  historyWeeks: number
  /** Test seam; defaults to `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}) {
  const C = useM().fuelTanulas
  const [reduce] = useState(() => reducedMotion ?? prefersReducedMotion())
  const [t, setT] = useState(reduce ? 1 : 0)

  useEffect(() => {
    if (reduce) return
    let raf = 0
    const t0 = performance.now()
    const frame = (now: number) => {
      const p = clamp01((now - t0) / DUR)
      setT(p)
      if (p < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [reduce])

  const n = series.length
  if (n === 0) return null
  const bw = W / n
  const cx = (i: number) => i * bw + bw / 2

  // Weight scale from the data (weigh-ins, trend, tissue) with a little padding.
  const kgs = series.flatMap(p => [p.weightKg, p.trendKg, p.tissueKg]).filter((v): v is number => v != null)
  const kgMin = kgs.length ? Math.min(...kgs) : 0
  const kgMax = kgs.length ? Math.max(...kgs) : 1
  const pad = Math.max(0.3, (kgMax - kgMin) * 0.12)
  const wmin = kgMin - pad
  const wmax = kgMax + pad
  const wy = (w: number) => TOP + (1 - (w - wmin) / (wmax - wmin)) * WEIGHT_H

  const kcals = series.map(p => p.intakeKcal).filter((v): v is number => v != null)
  const kMax = Math.max(3200, ...(kcals.length ? [Math.max(...kcals) * 1.07] : []))
  const ky = (k: number) => BAR_BASE - (k / kMax) * BAR_H

  // Trend line + water band, broken wherever a day lacks the trend (before the first weigh-in).
  let trendD = ''
  const bands: string[] = []
  let run: number[] = []
  const flush = () => {
    if (run.length) {
      const top = run.map((i, j) => `${j ? 'L' : 'M'}${cx(i)},${wy(series[i].trendKg!)}`).join('')
      const bottom = [...run].reverse().map(i => `L${cx(i)},${wy(series[i].tissueKg!)}`).join('')
      bands.push(`${top}${bottom}Z`)
    }
    run = []
  }
  let penUp = true
  series.forEach((p, i) => {
    if (p.trendKg == null) { penUp = true; flush(); return }
    trendD += `${penUp ? 'M' : 'L'}${cx(i)},${wy(p.trendKg)}`
    penUp = false
    if (p.tissueKg != null) run.push(i)
    else flush()
  })
  flush()

  const barCount = series.filter(p => p.intakeKcal != null && p.status !== 'unlogged').length
  let barIdx = 0
  const first = C.shortDay(huShortDate(series[0].date))
  const last = C.shortDay(huShortDate(series[n - 1].date))

  return (
    <svg className="ft-chart ft-how" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={C.how.chart.aria(historyWeeks, first, last)} data-progress={t}>
      <line className="grid" x1={0} x2={W} y1={BAR_BASE} y2={BAR_BASE} />
      {series.map((p, i) => {
        if (p.intakeKcal == null || p.status === 'unlogged') return null
        const h = BAR_BASE - ky(p.intakeKcal)
        const k = ease(clamp01(t * 1.6 - (barIdx++ / Math.max(1, barCount)) * 0.6))
        const bad = p.status === 'suspicious' || p.status === 'marked'
        return (
          <rect
            key={p.date}
            className={bad ? 'bad' : 'okc'}
            x={i * bw + 0.8} width={Math.max(0.4, bw - 1.6)} y={BAR_BASE - h * k} height={h * k} rx={1.6}
          />
        )
      })}
      {bands.map((d, i) => <path key={i} className="wband" d={d} />)}
      {series.map((p, i) => p.weightKg != null && (
        <circle key={p.date} className="raw" cx={cx(i)} cy={wy(p.weightKg)} r={1.7} />
      ))}
      {trendD && (
        <path className="tr" d={trendD} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ease(t)} />
      )}
      <text x={0} y={H - 2}>{first}</text>
      <text x={W} y={H - 2} textAnchor="end">{last}</text>
      <text x={W} y={12} textAnchor="end">{C.how.chart.weight}</text>
      <text x={W} y={ky(kMax * 0.94) - 4} textAnchor="end">{C.how.chart.eating}</text>
    </svg>
  )
}
