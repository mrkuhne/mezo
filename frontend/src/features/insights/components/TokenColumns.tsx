import type { LlmUsageDay } from '@/data/types'

const W = 360
const H = 120
const PAD = 6

/** Napi token-oszlopok — alul a bemenet (dv-lav), felül a kimenet (dv-sage); halmozott skála. */
export function TokenColumns({ days, ariaLabel }: { days: LlmUsageDay[]; ariaLabel: string }) {
  const max = Math.max(1, ...days.map((d) => d.inputTokens + d.outputTokens))
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2
  const stepX = innerW / Math.max(1, days.length)
  const barW = stepX * 0.7

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ width: '100%', height: 'auto' }}>
        {days.map((day, i) => {
          const total = day.inputTokens + day.outputTokens
          const totalH = (total / max) * innerH
          const inH = total === 0 ? 0 : (day.inputTokens / total) * totalH
          const x = PAD + i * stepX + (stepX - barW) / 2
          const yTop = PAD + innerH - totalH
          return (
            <g key={day.date}>
              <rect x={x} y={yTop} width={barW} height={totalH - inH} rx={1.5} fill="var(--dv-sage)" />
              <rect x={x} y={yTop + (totalH - inH)} width={barW} height={inH} rx={1.5} fill="var(--dv-lav)" />
            </g>
          )
        })}
      </svg>
      <div className="row gap-md" style={{ marginTop: 6 }}>
        <span className="eyebrow text-tertiary">
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--dv-lav)', marginRight: 5 }} />
          bemenet
        </span>
        <span className="eyebrow text-tertiary">
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--dv-sage)', marginRight: 5 }} />
          kimenet
        </span>
      </div>
    </div>
  )
}
