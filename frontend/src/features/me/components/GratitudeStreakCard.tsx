import { useGratitudeEntries } from '@/data/hooks'
import { gratitudeStreakDays } from '@/features/me/logic/gratitudeStreak'

interface Props { from: string; to: string; todayIso: string }

/** „Hálanapló” streak — derived from the fetched entries (medals precedent: nothing materialized). */
export function GratitudeStreakCard({ from, to, todayIso }: Props) {
  const { data, isPending } = useGratitudeEntries(from, to)
  if (isPending) return null
  const streak = gratitudeStreakDays(data.map((e) => e.occurredOn), todayIso)
  return (
    <section className="card" aria-label="Hálanapló">
      <div className="hd"><span className="t">Hálanapló</span></div>
      {data.length === 0
        ? <p className="muted">Még nincs hálabejegyzés — írd le az első hálás gondolatod.</p>
        : <p className="xp">{streak} napos sorozat · {data.length} bejegyzés</p>}
    </section>
  )
}
