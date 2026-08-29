import { ClayIcon } from '@/shared/ui/clay'
import { useGratitudeEntries } from '@/data/hooks'
import { gratitudeStreakDays } from '@/features/me/logic/gratitudeStreak'

interface Props { from: string; to: string; todayIso: string }

/** „Hálanapló” streak tile — derived from the fetched entries (medals precedent: nothing
 * materialized). Mozaik re-face (mezo-d20.6.6): the `.predtile.sage` card (en-body.html
 * #page-naplo), reusing the Előrejelzések/Kísérletek family's `.mzp-pred`/`.mzp-top`/`.mzp-pic`
 * classes and the sage `.mzp-stch` chip — same tokens, no new gradient literals. */
export function GratitudeStreakCard({ from, to, todayIso }: Props) {
  const { data, isPending } = useGratitudeEntries(from, to)
  if (isPending) return null
  const streak = gratitudeStreakDays(data.map((e) => e.occurredOn), todayIso)
  return (
    <section className="mzp-pred sage rise" style={{ '--d': '0ms' } as React.CSSProperties} aria-label="Hálanapló">
      <div className="mzp-top">
        <span className="mzp-pic"><ClayIcon name="i-naplo" size={19} /></span>
        <div className="mzj-grow">
          <b className="mzj-gtitle">Hálanapló</b>
          {data.length === 0
            ? <div className="mzj-gsub">Még nincs hálabejegyzés — írd le az első hálás gondolatod.</div>
            : <div className="mzj-gsub">{streak} napos sorozat · {data.length} bejegyzés</div>}
        </div>
        {data.length > 0 && <span className="mzp-stch ok">él a sorozat</span>}
      </div>
    </section>
  )
}
