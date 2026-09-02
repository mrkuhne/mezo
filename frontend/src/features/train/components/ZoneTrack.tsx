// ============================================================
// Mezo · ZoneTrack — the shared zone-bar primitive (mezo-oyhy.7):
// --surface-2 track + sage optimal-zone underlay (zoneStart → 100%) +
// ordered value segments. Kinds: solid (full rail color), today
// (55% + dashed-look inset ring in the deep shade), ghost (22%),
// overflow (coral→error gradient). Single source of the bar language —
// used by WeekZoneCard and ZoneMiniGrid (formerly also SetBudgetCard,
// retired for WeeklyBandsCard, mezo-d20.14).
// ============================================================
import type { CSSProperties } from 'react'
import type { ZoneSegment } from '@/features/train/logic/weekZone'

interface ZoneTrackProps {
  zoneStart: number | null
  segments: ZoneSegment[]
  /** Muscle color family pair — rail fills the segments, deep rings the today slice. */
  color: { rail: string; deep: string }
  height?: number
  zoneTestId?: string
}

export function ZoneTrack({ zoneStart, segments, color, height = 8.5, zoneTestId }: ZoneTrackProps) {
  let cursor = 0
  return (
    <div style={{ position: 'relative', height, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
      {zoneStart !== null && (
        <div
          {...(zoneTestId ? { 'data-testid': zoneTestId } : {})}
          style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            left: `${Math.min(100, Math.round(zoneStart * 100))}%`,
            background: 'color-mix(in srgb, var(--sage) 28%, transparent)',
          }}
        />
      )}
      {segments.map((seg, i) => {
        const left = cursor
        cursor += seg.pct
        const last = i === segments.length - 1
        const style: CSSProperties = {
          position: 'absolute', top: 0, bottom: 0,
          left: `${left * 100}%`, width: `${seg.pct * 100}%`,
          // Rounded outer end like the pre-refactor fill; inner joints stay square.
          borderRadius: last ? (i === 0 ? 999 : '0 999px 999px 0') : 0,
        }
        if (seg.kind === 'solid') style.background = color.rail
        else if (seg.kind === 'today') { style.background = color.rail; style.opacity = 0.55; style.boxShadow = `inset 0 0 0 1.5px ${color.deep}` }
        else if (seg.kind === 'ghost') { style.background = color.rail; style.opacity = 0.22 }
        else style.background = 'linear-gradient(90deg, var(--coral), var(--error))'
        return <div key={i} data-kind={seg.kind} style={style} />
      })}
    </div>
  )
}
