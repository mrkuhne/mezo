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

/** Az L1 napló (mezo-d20.5.7) — a prototípus .daycard arca: éjjel írt nap-kártyák
 *  hónap-elválasztókkal; a sarok-pötty a beágyazott embed-jelző (zsálya = van vektor). */
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
  let idx = -1
  return (
    <div className="col" style={{ gap: 0 }}>
      {summaries.map((summary) => {
        const month = monthLabel(summary.date)
        const showSeparator = month !== lastMonth
        lastMonth = month
        const focused = summary.date === focusDate
        idx += 1
        return (
          <div key={summary.date} className="col" style={{ gap: 0 }}>
            {showSeparator && <span className="mz-eyebrow mem-month">{month}</span>}
            <div
              ref={focused ? focusRef : undefined}
              className={`mem-daycard rise${focused ? ' focused' : ''}`}
              style={{ '--d': `${Math.min(idx, 5) * 60}ms` } as React.CSSProperties}
            >
              <span
                className={`mem-emb${summary.embedded ? '' : ' off'}`}
                aria-label={summary.embedded ? 'vektorizálva' : 'még nincs vektor'}
                title={summary.embedded ? 'vektorizálva' : 'még nincs vektor'}
              />
              <div className="mem-dl">{dayLabel(summary.date)}</div>
              <p className="mem-bd">{summary.narrative}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
