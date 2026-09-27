// ============================================================
// Mezo · a minta-részlet kétzónás grafikonja (mezo-rstt7, prototypes/uveg-minta-body.html `chart()`
// variant A). Két zóna (a metrika A szerint), zóna-átlagok, koppintható pöttyök — a kiválasztás
// SAJÁT (komponens-szintű) állapot, hogy egy koppintás ne mozgassa meg az egész oldalt.
// ============================================================
import { useState, type KeyboardEvent } from 'react'
import type { AlignedDay, PatternMonitorPair } from '@/data/types'
import { toneClass, type DetailTone } from '@/features/insights/components/DetailHero'
import { binaryGroupLabels, formatMetricValue } from '@/features/insights/logic/metricFormat'
import { mean, niceTicks, patternZones, zoneValue } from '@/features/insights/logic/patternReading'
import { cn } from '@/shared/lib/cn'
import { huMonthDay } from '@/shared/lib/dates'

const W = 340
const L = 32
const R = 334
const T = 54
const BT = 184

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Az y-tengely felirata: óra-metrikán a szokásos óraformátum, egyébként egész vagy egy tizedes. */
function tickLabel(pair: PatternMonitorPair, v: number): string {
  if (pair.metricBValueKind === 'clock_hour') return formatMetricValue(pair.metricBKey, v)
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')
}

export function PatternZoneChart({ days, pair, showAverages, tone }: {
  days: AlignedDay[]
  pair: PatternMonitorPair
  showAverages: boolean
  tone: DetailTone
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const binary = pair.metricAValueKind === 'binary'
  const H = BT + (binary ? 44 : 40)
  const [zone0, zone1] = patternZones(days, binary)

  const bs = days.map((d) => d.b)
  const bLo = bs.length ? Math.min(...bs) : 0
  const bHi = bs.length ? Math.max(...bs) : 0
  const bPad = (bHi - bLo || 1) * 0.15
  const y0 = bLo - bPad
  const y1 = bHi + bPad
  const y = (v: number) => BT - (v - y0) / ((y1 - y0) || 1) * (BT - T)
  const yTicks = niceTicks(y0, y1, pair.metricBValueKind === 'clock_hour', 3)
    .filter((v) => v >= y0 - 1e-9 && v <= y1 + 1e-9)

  const as = days.map((d) => d.a)
  const aLoRaw = as.length ? Math.min(...as) : 0
  const aHiRaw = as.length ? Math.max(...as) : 0
  const aPad = (aHiRaw - aLoRaw || 1) * 0.08
  const aLo = aLoRaw - aPad
  const aHi = aHiRaw + aPad
  const xOfValue = (v: number) => L + 8 + (v - aLo) / ((aHi - aLo) || 1) * (R - L - 16)
  const xTicks = binary ? [] : niceTicks(aLo, aHi, pair.metricAValueKind === 'clock_hour')
    .filter((v) => v >= aLo && v <= aHi)

  // `i` is the point's index in the `days` prop (jitter and selection both key off it) — the
  // caller always has it in hand (a `.map` index, or the stored `selected` state), so this never
  // needs to re-derive it with `days.indexOf`.
  const xOf = (day: AlignedDay, i: number): number => {
    if (!binary) return xOfValue(day.a)
    const jitter = ((i * 37) % 23 - 11) * 5.4
    return (day.a >= 0.5 ? (R + 183) / 2 : (L + 177) / 2) + jitter
  }

  const split = binary
    ? 180
    : (zone0.length && zone1.length ? (xOf(zone0[zone0.length - 1], 0) + xOf(zone1[0], 0)) / 2 : (L + R) / 2)

  const zeroLabel = binaryGroupLabels(pair.metricAKey).zero.axis
  const oneLabel = binaryGroupLabels(pair.metricAKey).one.axis

  const head = (group: AlignedDay[], x1: number, x2: number) => {
    if (!group.length) return null
    const cx = (x1 + x2) / 2
    return (
      <>
        {showAverages && (
          <text className="pmx-zh" x={cx} y={T - 24} textAnchor="middle">{zoneValue(pair, mean(group))}</text>
        )}
        <text className="pmx-zs" x={cx} y={T - 9} textAnchor="middle">
          {showAverages ? `átlag · ${group.length} nap` : `${group.length} nap`}
        </text>
      </>
    )
  }

  const avg = (group: AlignedDay[], x1: number, x2: number) => {
    if (!group.length || !showAverages) return null
    const yv = y(mean(group))
    return <line className="pmx-avg" x1={x1 + 9} x2={x2 - 9} y1={yv} y2={yv} />
  }

  const aValueOf = (day: AlignedDay) => binary
    ? (day.a >= 0.5 ? oneLabel : zeroLabel)
    : formatMetricValue(pair.metricAKey, day.a)
  const bValueOf = (day: AlignedDay) => formatMetricValue(pair.metricBKey, day.b)

  const toggle = (i: number) => setSelected((s) => (s === i ? null : i))
  const onKeyDown = (i: number) => (e: KeyboardEvent<SVGCircleElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i) }
  }

  const selectedDay = selected != null ? days[selected] : null
  let tooltip: { px: number; py: number; tx: number; ty: number; w: number; line1: string; line2: string } | null = null
  if (selectedDay && selected != null) {
    const px = xOf(selectedDay, selected)
    const py = y(selectedDay.b)
    const line1 = `${huMonthDay(selectedDay.date)} · ${binary ? aValueOf(selectedDay) : `${pair.metricALabel} ${aValueOf(selectedDay)}`}`
    const line2 = `${pair.metricBLabel}: ${bValueOf(selectedDay)}`
    const w = Math.max(line1.length, line2.length) * 6.1 + 20
    const tx = Math.max(L, Math.min(R - w, px - w / 2))
    const ty = py - 58 < 4 ? py + 14 : py - 58
    tooltip = { px, py, tx, ty, w, line1, line2 }
  }

  return (
    <section className={cn('glass', 'pmx-chart', 'rise', toneClass(tone))}>
      <svg viewBox={`0 0 ${W} ${H}`} role="group"
        aria-label={`${days.length} nap: ${pair.metricALabel} és ${pair.metricBLabel} kapcsolata`}>
        <rect className="pmx-zone" x={L} y={T - 44} width={Math.max(0, split - L - 3)} height={BT - T + 48} rx={14} />
        <rect className="pmx-zone b" x={split + 3} y={T - 44} width={Math.max(0, R - split - 3)} height={BT - T + 48} rx={14} />
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line className="pmx-grid" x1={L} x2={R} y1={y(v)} y2={y(v)} />
            <text className="pmx-tk" x={L - 6} y={y(v) + 3.5} textAnchor="end">{tickLabel(pair, v)}</text>
          </g>
        ))}
        {head(zone0, L, split)}
        {head(zone1, split, R)}
        {avg(zone0, L, split)}
        {avg(zone1, split, R)}
        {days.map((day, i) => (
          <circle key={day.date} className={cn('pmx-pt', selected === i && 'is-selected')}
            cx={xOf(day, i)} cy={y(day.b)} r={5.5}
            role="button" tabIndex={0}
            aria-label={binary
              ? `${day.date}: ${aValueOf(day)}, ${pair.metricBLabel} ${bValueOf(day)}`
              : `${day.date}: ${pair.metricALabel} ${aValueOf(day)}, ${pair.metricBLabel} ${bValueOf(day)}`}
            aria-pressed={selected === i}
            onClick={() => toggle(i)}
            onKeyDown={onKeyDown(i)} />
        ))}
        {binary ? (
          <>
            <text className="pmx-zl" x={(L + split) / 2} y={BT + 24} textAnchor="middle">{cap(zeroLabel)}</text>
            <text className="pmx-zl" x={(split + R) / 2} y={BT + 24} textAnchor="middle">{cap(oneLabel)}</text>
          </>
        ) : (
          <>
            {xTicks.map((v) => (
              <g key={`x-${v}`}>
                <line className="pmx-xt" x1={xOfValue(v)} x2={xOfValue(v)} y1={BT + 4} y2={BT + 8} />
                <text className="pmx-tk" x={xOfValue(v)} y={BT + 20} textAnchor="middle">
                  {formatMetricValue(pair.metricAKey, v)}
                </text>
              </g>
            ))}
            <text className="pmx-xl" x={R} y={BT + 36} textAnchor="end">{pair.metricALabel} →</text>
          </>
        )}
        {tooltip && (
          <>
            <circle className="pmx-selring" cx={tooltip.px} cy={tooltip.py} r={10} />
            <g className="pmx-tip">
              <rect x={tooltip.tx} y={tooltip.ty} width={tooltip.w} height={44} rx={10} />
              <text x={tooltip.tx + 10} y={tooltip.ty + 18}>{tooltip.line1}</text>
              <text className="pmx-tip-b" x={tooltip.tx + 10} y={tooltip.ty + 35}>{tooltip.line2}</text>
            </g>
          </>
        )}
      </svg>
      <div className="pmx-foot">
        <span>{cap(pair.metricBLabel)} · koppints egy pöttyre</span>
        <details className="pmx-days">
          <summary>Napok listája ›</summary>
          <table>
            <thead><tr><th>Nap</th><th>{pair.metricALabel}</th><th>{pair.metricBLabel}</th></tr></thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date}>
                  <td>{huMonthDay(day.date)}</td>
                  <td>{aValueOf(day)}</td>
                  <td>{bValueOf(day)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  )
}
