import type { SleepEntry, SleepTrends } from '@/data/types'

type Period = '7d' | '14d'

function sliceForPeriod(entries: SleepEntry[], period: Period): SleepEntry[] {
  return period === '7d' ? entries.slice(-7) : entries.slice(-14)
}

export function SleepChart({
  entries,
  target,
  period,
}: {
  entries: SleepEntry[]
  target: SleepTrends['target']
  period: Period
}) {
  const data = sliceForPeriod(entries, period)
  if (data.length < 2) return null

  const W = 380
  const H = 150
  const padX = 8
  const padY = 14
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const maxDur = Math.max(9, ...data.map(d => d.duration)) + 0.2
  const minDur = Math.min(5.5, ...data.map(d => d.duration))
  const durRange = maxDur - minDur

  const barW = (innerW / data.length) * 0.7
  const stepX = innerW / data.length

  const xFor = (i: number) => padX + i * stepX + stepX / 2
  const yForDur = (v: number) => padY + (1 - (v - minDur) / durRange) * innerH
  const yForQual = (q: number) => padY + (1 - q / 10) * innerH

  const qualPath = data.map((d, i) => (i === 0 ? 'M' : 'L') + xFor(i) + ' ' + yForQual(d.quality)).join(' ')
  const targetY = yForDur(target.duration)

  return (
    <div className="card notch-12" style={{ padding: 14 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="sleep-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cat-preference)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--cat-preference)" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Target duration line */}
        <line
          x1={padX}
          x2={W - padX}
          y1={targetY}
          y2={targetY}
          stroke="var(--cat-preference)"
          strokeWidth="0.8"
          strokeDasharray="4 4"
          opacity="0.5"
        />
        <text
          x={W - padX}
          y={targetY - 4}
          fontFamily="var(--ff-mono)"
          fontSize="9"
          fill="var(--cat-preference)"
          textAnchor="end"
          opacity="0.7"
        >
          target {target.duration}h
        </text>

        {/* Duration bars */}
        {data.map((d, i) => {
          const x = xFor(i) - barW / 2
          const y = yForDur(d.duration)
          const h = padY + innerH - y
          const isLow = d.duration < 7 || d.quality <= 5
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={isLow ? 'var(--warning)' : 'url(#sleep-bar)'}
              opacity={isLow ? 0.55 : 1}
            />
          )
        })}

        {/* Quality line */}
        <path
          d={qualPath}
          fill="none"
          stroke="var(--brand-glow)"
          strokeWidth="1.8"
          style={{ filter: 'drop-shadow(0 0 3px var(--brand-glow))' }}
        />

        {/* Quality dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yForQual(d.quality)}
            r="2.5"
            fill="var(--brand-glow)"
            stroke="var(--canvas)"
            strokeWidth="1.2"
          />
        ))}
      </svg>
      <div className="row mt-sm gap-md" style={{ justifyContent: 'center' }}>
        <div className="row gap-xs">
          <div style={{ width: 10, height: 4, background: 'var(--cat-preference)' }} />
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>időtartam</span>
        </div>
        <div className="row gap-xs">
          <div style={{ width: 10, height: 2, background: 'var(--brand-glow)' }} />
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>minőség 1-10</span>
        </div>
      </div>
    </div>
  )
}
