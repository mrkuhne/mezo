import { binaryGroupLabels, formatMetricValue } from '@/features/insights/logic/metricFormat'
import { evidenceAxis, groupedEvidence } from '@/features/insights/logic/patternEvidence'
import { fitLine } from '@/features/insights/logic/patternHistory'
import type { AlignedDay, PatternMonitorPair } from '@/data/types'

const WIDTH = 340
const HEIGHT = 235
const LEFT = 49
const RIGHT = 326
const TOP = 18
const BOTTOM = 184

function formatAxisTick(metricKey: string, value: number) {
  // A nap vége a tengelyen 24:00, nem a következő nap 00:00-ja.
  return metricKey === 'late-meal-hour' && value === 24 ? '24:00' : formatMetricValue(metricKey, value)
}

function scale(value: number, min: number, max: number, low: number, high: number) {
  return low + ((value - min) / (max - min || 1)) * (high - low)
}

function BinaryChart({ days, pair }: { days: AlignedDay[]; pair: PatternMonitorPair }) {
  const required = pair.requiredPerGroup ?? 3
  const groups = groupedEvidence(days, required)
  const labels = binaryGroupLabels(pair.metricAKey)
  const axis = evidenceAxis(days.map((day) => day.b), pair.metricBValueKind, 4)
  const latest = groups.latest
  const y = (value: number) => scale(value, axis.min, axis.max, BOTTOM, TOP)
  const jitter = [-14, -5, 5, 14, -10, 0, 10, -2]
  const center = (value: number) => value < 0.5 ? 105 : 242

  return (
    <svg className="pdt-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
      aria-label={`${pair.metricBLabel}: ${groups.zero.count} ${labels.zero.day} és ${groups.one.count} ${labels.one.day} nap`}>
      <rect className="pdt-chart-col pdt-chart-col-zero" x="61" y="10" width="89" height="181" rx="17" />
      <rect className="pdt-chart-col pdt-chart-col-one" x="198" y="10" width="89" height="181" rx="17" />
      {axis.ticks.map((tick) => (
        <g key={tick}>
          <line className="pdt-chart-grid" x1={LEFT} x2={RIGHT} y1={y(tick)} y2={y(tick)} />
          <text className="pdt-chart-tick" x={LEFT - 6} y={y(tick) + 3} textAnchor="end">
            {formatAxisTick(pair.metricBKey, tick)}
          </text>
        </g>
      ))}
      {days.map((day, index) => (
        <circle key={day.date} className={day.a < 0.5 ? 'pdt-dot-zero' : 'pdt-dot-one'}
          cx={center(day.a) + jitter[index % jitter.length]} cy={y(day.b)} r="5" />
      ))}
      {groups.zero.median != null && (
        <line className="pdt-median-zero" x1="73" x2="137" y1={y(groups.zero.median)} y2={y(groups.zero.median)} />
      )}
      {groups.one.median != null && (
        <line className="pdt-median-one" x1="210" x2="274" y1={y(groups.one.median)} y2={y(groups.one.median)} />
      )}
      {latest && (
        <circle aria-label={`legutóbbi nap: ${latest.date}`} cx={center(latest.a) + jitter[(days.indexOf(latest)) % jitter.length]}
          cy={y(latest.b)} r="10" fill="none" className="pdt-latest-ring" />
      )}
      <text className="pdt-group-label pdt-zero-label" x="105" y="207" textAnchor="middle">
        {labels.zero.axis[0].toUpperCase() + labels.zero.axis.slice(1)}
      </text>
      <text className="pdt-group-label pdt-one-label" x="242" y="207" textAnchor="middle">
        {labels.one.axis[0].toUpperCase() + labels.one.axis.slice(1)}
      </text>
      <text className="pdt-chart-caption" x="105" y="221" textAnchor="middle">
        {groups.zero.median == null ? 'még nincs medián' : `medián ${formatMetricValue(pair.metricBKey, groups.zero.median)}`}
      </text>
      <text className="pdt-chart-caption" x="242" y="221" textAnchor="middle">
        {groups.one.median == null ? 'még nincs medián' : `medián ${formatMetricValue(pair.metricBKey, groups.one.median)}`}
      </text>
    </svg>
  )
}

function NumericChart({ days, pair }: { days: AlignedDay[]; pair: PatternMonitorPair }) {
  const xAxis = evidenceAxis(days.map((day) => day.a), pair.metricAValueKind)
  const yAxis = evidenceAxis(days.map((day) => day.b), pair.metricBValueKind)
  const x = (value: number) => scale(value, xAxis.min, xAxis.max, LEFT, RIGHT)
  const y = (value: number) => scale(value, yAxis.min, yAxis.max, BOTTOM, TOP)
  const latest = days.reduce((current, day) => day.date > current.date ? day : current, days[0])
  const fit = pair.verdict === 'live' ? fitLine(days) : null

  return (
    <svg className="pdt-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
      aria-label={`${pair.metricALabel} és ${pair.metricBLabel} kapcsolata ${days.length} napon`}>
      {yAxis.ticks.map((tick) => (
        <g key={`y-${tick}`}>
          <line className="pdt-chart-grid" x1={LEFT} x2={RIGHT} y1={y(tick)} y2={y(tick)} />
          <text className="pdt-chart-tick" x={LEFT - 6} y={y(tick) + 3} textAnchor="end">{formatAxisTick(pair.metricBKey, tick)}</text>
        </g>
      ))}
      {xAxis.ticks.map((tick) => (
        <text key={`x-${tick}`} className="pdt-chart-tick" x={x(tick)} y={BOTTOM + 19} textAnchor="middle">
          {formatAxisTick(pair.metricAKey, tick)}
        </text>
      ))}
      {fit && <line aria-label="trendvonal" className="pdt-trend" x1={x(xAxis.min)}
        y1={y(fit.slope * xAxis.min + fit.intercept)} x2={x(xAxis.max)}
        y2={y(fit.slope * xAxis.max + fit.intercept)} />}
      {days.map((day) => <circle key={day.date} className="pdt-dot-number" cx={x(day.a)} cy={y(day.b)} r="5" />)}
      <circle aria-label={`legutóbbi nap: ${latest.date}`} cx={x(latest.a)} cy={y(latest.b)} r="10"
        fill="none" className="pdt-latest-ring" />
      <text className="pdt-axis-label" x={(LEFT + RIGHT) / 2} y="226" textAnchor="middle">{pair.metricALabel}</text>
    </svg>
  )
}

export function PatternEvidenceChart({ days, pair }: { days: AlignedDay[]; pair: PatternMonitorPair }) {
  if (days.length < 2) return null
  return pair.metricAValueKind === 'binary'
    ? <BinaryChart days={days} pair={pair} />
    : <NumericChart days={days} pair={pair} />
}
