import type { WeightEntry } from '@/data/types'

type Period = '7d' | '30d' | 'all'

function sliceForPeriod(entries: WeightEntry[], period: Period): WeightEntry[] {
  if (period === '7d') return entries.slice(-7)
  if (period === '30d') return entries.slice(-30)
  return entries
}

export function WeightChart({
  entries,
  startWeight,
  targetWeight,
  period,
}: {
  entries: WeightEntry[]
  startWeight: number
  targetWeight: number
  period: Period
}) {
  const data = sliceForPeriod(entries, period)
  if (data.length < 2) return null

  const W = 380
  const H = 140
  const padX = 8
  const padY = 14
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  // Y-axis bounds: top anchored to the goal's start weight, bottom to the target
  const minV = Math.min(targetWeight, ...data.map(d => d.value)) - 0.5
  const maxV = Math.max(startWeight, ...data.map(d => d.value)) + 0.5
  const range = maxV - minV

  const xFor = (i: number) => padX + (i / (data.length - 1)) * innerW
  const yFor = (v: number) => padY + (1 - (v - minV) / range) * innerH

  // Raw line
  const linePath = data.map((d, i) => (i === 0 ? 'M' : 'L') + xFor(i) + ' ' + yFor(d.value)).join(' ')
  const areaPath =
    linePath + ' L ' + xFor(data.length - 1) + ' ' + (padY + innerH) + ' L ' + padX + ' ' + (padY + innerH) + ' Z'

  // Moving average (3-pt trailing)
  const ma = data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - 2), i + 1)
    return slice.reduce((a, x) => a + x.value, 0) / slice.length
  })
  const maPath = ma.map((v, i) => (i === 0 ? 'M' : 'L') + xFor(i) + ' ' + yFor(v)).join(' ')

  // Goal line
  const goalY = yFor(targetWeight)

  const last = data[data.length - 1]
  const lastIdx = data.length - 1

  return (
    <div className="card notch-12" style={{ padding: 14 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-glow)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--brand-glow)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Target line */}
        <line
          x1={padX}
          x2={W - padX}
          y1={goalY}
          y2={goalY}
          stroke="var(--brand-glow)"
          strokeWidth="0.8"
          strokeDasharray="4 4"
          opacity="0.5"
        />
        <text
          x={W - padX}
          y={goalY - 4}
          fontFamily="var(--ff-mono)"
          fontSize="9"
          fill="var(--brand-glow)"
          textAnchor="end"
          opacity="0.7"
        >
          target {targetWeight}
        </text>

        {/* Area + raw line */}
        <path d={areaPath} fill="url(#weight-area)" />
        <path d={linePath} fill="none" stroke="var(--brand-glow)" strokeWidth="1.2" opacity="0.55" />

        {/* Moving average */}
        <path
          d={maPath}
          fill="none"
          stroke="var(--brand-glow)"
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 0 4px var(--brand-glow))' }}
        />

        {/* Dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(d.value)}
            r={i === lastIdx ? 4 : 2}
            fill={i === lastIdx ? 'var(--brand-glow)' : 'var(--text-secondary)'}
            stroke={i === lastIdx ? 'var(--canvas)' : 'none'}
            strokeWidth="2"
          />
        ))}

        {/* Latest value label */}
        <text
          x={xFor(lastIdx) - 8}
          y={yFor(last.value) - 8}
          fontFamily="var(--ff-mono)"
          fontSize="10"
          fill="var(--brand-glow)"
          textAnchor="end"
        >
          {last.value}
        </text>
      </svg>

      {/* Notes for entries with notes (latest two) */}
      {data
        .filter(d => d.note)
        .slice(-2)
        .map((d, i) => (
          <div
            key={i}
            className="row gap-sm mt-sm"
            style={{
              alignItems: 'flex-start',
              paddingTop: i === 0 ? 8 : 0,
              borderTop: i === 0 ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            <span
              className="label-mono"
              style={{ fontSize: 9, color: 'var(--brand-glow)', whiteSpace: 'nowrap', paddingTop: 1 }}
            >
              {d.date.slice(5).replace('-', '/')}
            </span>
            <span className="text-tertiary" style={{ fontSize: 10, lineHeight: 1.4, flex: 1, fontStyle: 'italic' }}>
              "{d.note}"
            </span>
          </div>
        ))}
    </div>
  )
}
