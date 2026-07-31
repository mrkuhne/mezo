import type { PhaseBreakdown } from '@/features/me/logic/sleepPhases'

/** Stack order — deep at the base, awake last: the night read from its floor upwards. */
const SEGMENTS = [
  { key: 'deep', label: 'Mély', color: 'var(--ph-deep)' },
  { key: 'light', label: 'Könnyű', color: 'var(--ph-light)' },
  { key: 'rem', label: 'REM', color: 'var(--ph-rem)' },
  { key: 'awake', label: 'Éber', color: 'var(--ph-awake)' },
] as const

export function fmtHm(min: number): string {
  const h = Math.floor(min / 60)
  return h > 0 ? `${h}ó ${min % 60}p` : `${min}p`
}

/**
 * The proportional phase rail (mezo-fk9a). Segment WIDTHS denominate on `inBed` so the four
 * segments fill the rail; legend PERCENTAGES denominate on `asleep` because awake time is
 * fragmentation, not a sleep stage. The two denominators differ on purpose.
 */
export function PhaseRail({
  breakdown,
  showLegend = true,
  height = 13,
}: {
  breakdown: PhaseBreakdown
  showLegend?: boolean
  height?: number
}) {
  const label = SEGMENTS
    .filter(s => breakdown[s.key] > 0)
    .map(s => `${s.label} ${fmtHm(breakdown[s.key])}`)
    .join(', ')

  return (
    <>
      <div
        className="phrail"
        style={{ height, borderRadius: height / 2 }}
        role="img"
        aria-label={`Alvásfázisok: ${label}`}
      >
        {SEGMENTS.map(s =>
          breakdown[s.key] > 0 ? (
            <i
              key={s.key}
              style={{ width: `${(breakdown[s.key] / breakdown.inBed) * 100}%`, background: s.color }}
            />
          ) : null,
        )}
      </div>
      {showLegend && (
        <div className="phleg">
          {SEGMENTS.map(s =>
            breakdown[s.key] > 0 ? (
              <div key={s.key} className="phleg-it">
                <span className="phleg-dot" style={{ background: s.color }} />
                {s.label}
                <span className="phleg-v">{fmtHm(breakdown[s.key])}</span>
                {s.key !== 'awake' && (
                  <span className="phleg-p">
                    {Math.round((breakdown[s.key] / breakdown.asleep) * 100)}%
                  </span>
                )}
              </div>
            ) : null,
          )}
        </div>
      )}
    </>
  )
}
