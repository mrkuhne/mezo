import { STAT_DECK, dailyStatIndex } from '@/features/me/logic/sleepEducation'
import { localDateString } from '@/shared/lib/dates'

/** The daily-rotating Walker education card (slice C3, spec D3) — one stat per day,
 *  deterministic by date. The whole card taps through to the full deck sheet. */
export function SleepStatCard({ onOpen }: { onOpen: () => void }) {
  const stat = STAT_DECK[dailyStatIndex(localDateString())]
  return (
    <button className="sstat" onClick={onOpen}>
      <span className="sstat-eye">Miért számít?</span>
      <span className="sstat-title">{stat.title}</span>
      <span className="sstat-text">{stat.text}</span>
      <span className="sstat-src">{stat.source}</span>
    </button>
  )
}
