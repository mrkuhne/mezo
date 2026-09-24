import { Icon3D } from '@/shared/ui/clay'
import { STAT_DECK, dailyStatIndex } from '@/features/me/logic/sleepEducation'
import { localDateString } from '@/shared/lib/dates'

/** The daily-rotating Walker education card (slice C3, spec D3) — one stat per day,
 *  deterministic by date. The whole card taps through to the full deck sheet.
 *  Üveg (mezo-me75u.6): a gold glass card with the 3D book, styled under `.alv-page`. */
export function SleepStatCard({ onOpen }: { onOpen: () => void }) {
  const stat = STAT_DECK[dailyStatIndex(localDateString())]
  return (
    <button type="button" className="sstat glass" onClick={onOpen}>
      <span className="sstat-head">
        <Icon3D name="t-book" size={30} />
        <span className="sstat-eye">Miért számít?</span>
        <span className="sstat-chev" aria-hidden="true">›</span>
      </span>
      <span className="sstat-title">{stat.title}</span>
      <span className="sstat-text">{stat.text}</span>
      <span className="sstat-src">{stat.source}</span>
    </button>
  )
}
