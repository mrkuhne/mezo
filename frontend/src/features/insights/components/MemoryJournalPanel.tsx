import { useEffect, useRef } from 'react'
import type { MemorySummaryItem } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'

function monthLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('hu-HU', {
    month: 'long', day: 'numeric', weekday: 'long',
  })
}

/** Az L1 napló — memoir-tipográfiájú kártyák hónap-elválasztókkal; a sarok-pötty az embed-jelző. */
export function MemoryJournalPanel({
  summaries, focusDate,
}: { summaries: MemorySummaryItem[]; focusDate?: string | null }) {
  const focusRef = useRef<HTMLDivElement>(null)
  useEffect(() => { focusRef.current?.scrollIntoView({ block: 'center' }) }, [focusDate])

  if (summaries.length === 0) {
    return (
      <GhostState message="Az első éjszakai összefoglaló még nem készült el — a napló éjjelente, magától íródik." />
    )
  }

  let lastMonth = ''
  return (
    <div className="col gap-md">
      {summaries.map((summary) => {
        const month = monthLabel(summary.date)
        const showSeparator = month !== lastMonth
        lastMonth = month
        const focused = summary.date === focusDate
        return (
          <div key={summary.date} className="col gap-md">
            {showSeparator && (
              <span className="eyebrow text-tertiary" style={{ marginTop: 4 }}>{month}</span>
            )}
            <div
              ref={focused ? focusRef : undefined}
              className="card memoir-card"
              style={{
                padding: 18, position: 'relative', overflow: 'hidden',
                border: focused ? '1px solid var(--lav-deep)' : undefined,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', width: 100, height: 100, right: -32, top: -32, borderRadius: '50%',
                  background: 'radial-gradient(circle, color-mix(in srgb, var(--lav) 16%, transparent), transparent 70%)',
                }}
              />
              <span
                aria-label={summary.embedded ? 'vektorizálva' : 'még nincs vektor'}
                title={summary.embedded ? 'vektorizálva' : 'még nincs vektor'}
                style={{
                  position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%',
                  background: summary.embedded ? 'var(--success)' : 'var(--text-tertiary)', opacity: 0.7,
                }}
              />
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{dayLabel(summary.date)}</span>
              <p style={{ fontSize: 14, lineHeight: 1.65, marginTop: 10, color: 'var(--text-primary)' }}>
                {summary.narrative}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
