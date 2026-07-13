import { daypartNow } from '@/shared/lib/daypart'
import type { TodayMeta, UserMeta } from '@/data/types'

export function GreetingHeader({ today, user, retaDay, now = new Date() }: {
  today: TodayMeta; user: UserMeta; retaDay: number; now?: Date
}) {
  const dp = daypartNow(now)
  return (
    <div className="greet">
      <div className="greet-day">{today.dayLabel} · {today.dateLabel} · Reta D{retaDay}</div>
      <h1>
        {dp === 'reggel' && <>Szép reggelt, {user.name} — <em>induljunk.</em></>}
        {dp === 'delutan' && <>Szia {user.name} — <em>jó napod lesz.</em></>}
        {dp === 'este' && <>Szép estét — <em>zárjuk a napot.</em></>}
      </h1>
    </div>
  )
}
