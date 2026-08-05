import { cn } from '@/shared/lib/cn'

export interface AdherenceSegment {
  /** Stable key + legend name */
  name: string
  /** 0..1 share of the track width */
  fraction: number
  /** CSS color — a data-viz token (var(--macro-*) / var(--dv-*)), per DS band rules */
  color: string
  /** Optional legend value text, e.g. "22g" */
  value?: string
}

/**
 * Grouped multi-segment progress (DS §AdherenceBar): one 12px track summarizing
 * 3–5 series — each segment in its data-viz color, the unfilled remainder shows
 * as recess. Legend below: swatch + name (600) + value (400). Segments are
 * clamped so the stack never overflows the track.
 */
export function AdherenceBar({ segments, legend = true, className }: {
  segments: AdherenceSegment[]
  legend?: boolean
  className?: string
}) {
  let used = 0
  const clamped = segments.map(s => {
    const width = Math.max(0, Math.min(s.fraction, 1 - used))
    used += width
    return { ...s, width }
  })
  return (
    <div className={className}>
      <div className="adher-track" role="img" aria-label={segments.map(s => `${s.name} ${Math.round(s.fraction * 100)}%`).join(', ')}>
        {clamped.map(s => (
          <div key={s.name} style={{ width: `${Math.round(s.width * 10000) / 100}%`, background: s.color }} />
        ))}
      </div>
      {legend && (
        <div className="adher-legend">
          {segments.map(s => (
            <span key={s.name} className={cn('adher-key')}>
              <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
              <span className="name">{s.name}</span>
              {s.value && <span>{s.value}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
