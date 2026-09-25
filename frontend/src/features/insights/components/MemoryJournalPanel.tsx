import { useEffect, useRef } from 'react'
import type { MemorySummaryItem } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'

function monthLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
}

/** A lit dátum-blokk két sora: a hónap napja és a hónap rövid neve (pont nélkül). */
function dayParts(date: string): { day: number; month: string } {
  const d = new Date(`${date}T00:00:00`)
  return { day: d.getDate(), month: d.toLocaleDateString('hu-HU', { month: 'short' }).replace(/\.$/, '') }
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('hu-HU', {
    month: 'long', day: 'numeric', weekday: 'long',
  })
}

/** Az L1 napló (mezo-d20.5.7, üveg mezo-me75u.8) — a prototípus .jday arca: lapos nap-sorok
 *  világító dátum-blokkal, hónap-fejekkel; a sarok-pötty a vetített (memory_item → memory_vector) jelző
 *  (zsálya = van élő vektor, mezo-eq85.10-től a szolgáló generációra szűrve). */
export function MemoryJournalPanel({
  summaries, focusDate,
}: { summaries: MemorySummaryItem[]; focusDate?: string | null }) {
  const focusRef = useRef<HTMLDivElement>(null)
  useEffect(() => { focusRef.current?.scrollIntoView({ block: 'center' }) }, [focusDate])

  if (summaries.length === 0) {
    return (
      <div className="mmr-ghost">
        <GhostState message="Az első éjszakai összefoglaló még nem készült el — a napló éjjelente, magától íródik." />
      </div>
    )
  }

  let lastMonth = ''
  let idx = -1
  return (
    <div className="mmr-journal">
      {summaries.map((summary) => {
        const month = monthLabel(summary.date)
        const showSeparator = month !== lastMonth
        lastMonth = month
        const focused = summary.date === focusDate
        idx += 1
        const parts = dayParts(summary.date)
        return (
          <div key={summary.date} className="mmr-dayslot">
            {showSeparator && <div className="mmr-month"><strong>{month}</strong></div>}
            <div
              ref={focused ? focusRef : undefined}
              className={`mmr-day rise${focused ? ' focused' : ''}`}
              style={{ '--d': `${Math.min(idx, 5) * 60}ms` } as React.CSSProperties}
            >
              <span
                className={`mmr-vd${summary.embedded ? '' : ' off'}`}
                aria-label={summary.embedded ? 'vektorizálva' : 'még nincs vektor'}
                title={summary.embedded ? 'vektorizálva' : 'még nincs vektor'}
              />
              <span className="mmr-dblk" aria-hidden="true"><b>{parts.day}</b><small>{parts.month}</small></span>
              <div className="mmr-daygrow">
                <strong className="mmr-dl">{dayLabel(summary.date)}</strong>
                <p className="mmr-bd">{summary.narrative}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
