import { Icon3D } from '@/shared/ui/clay'
import { useGratitudeEntries } from '@/data/hooks'
import { gratitudeStreakDays } from '@/features/me/logic/gratitudeStreak'

interface Props { from: string; to: string; todayIso: string }

/** „Hálanapló” streak tile — derived from the fetched entries (medals precedent: nothing
 * materialized). Üveg (mezo-me75u.7, prototype uveg-en2 `naplo()`): ONE sage glass card — the
 * t-heart mark, the title + sub line, and the „él a sorozat" state as a flat sage chip with the
 * t-flame. Styled in the `── uveg en2 naplo (` block (scoped to `.mzj-page`, its only host). */
export function GratitudeStreakCard({ from, to, todayIso }: Props) {
  const { data, isPending } = useGratitudeEntries(from, to)
  if (isPending) return null
  const streak = gratitudeStreakDays(data.map((e) => e.occurredOn), todayIso)
  return (
    <section className="mzj-grat glass rise" style={{ '--c': 'var(--dv-sage)', '--d': '0ms' } as React.CSSProperties} aria-label="Hálanapló">
      <div className="mzj-grat-top">
        <Icon3D name="t-heart" size={34} />
        <div className="mzj-grow">
          <b className="mzj-gtitle">Hálanapló</b>
          {data.length === 0
            ? <div className="mzj-gsub">Még nincs hálabejegyzés — írd le az első hálás gondolatod.</div>
            : <div className="mzj-gsub">{streak} napos sorozat · {data.length} bejegyzés</div>}
        </div>
        {data.length > 0 && (
          <span className="mzj-gchip"><Icon3D name="t-flame" size={16} />él a sorozat</span>
        )}
      </div>
    </section>
  )
}
