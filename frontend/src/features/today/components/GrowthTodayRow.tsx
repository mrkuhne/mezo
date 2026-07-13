import { Link } from 'react-router-dom'
import { useActivities, useDailyQuests } from '@/data/hooks'
import { growthTodaySummary } from '@/features/today/logic/growthToday'
import { Icon } from '@/shared/ui/Icon'
import { localDateString } from '@/shared/lib/dates'

/**
 * Today's one-row Growth teaser (S3 relocation, mezo-8141): quests + the activity
 * log moved to /me/growth — this row is Today's only remaining growth surface,
 * summarizing today's quest completion + XP earned so far. Ghost (renders null)
 * when both sources are empty — real mode must never show mock-seed data before
 * the backend has anything for today.
 */
export function GrowthTodayRow() {
  const date = localDateString()
  const { quests } = useDailyQuests(date)
  const { data: entries } = useActivities(date)

  if (quests.length === 0 && entries.length === 0) return null

  const { done, total, xp } = growthTodaySummary(quests, entries)

  return (
    <Link to="/me/growth" className="growrow np-press">
      <span>🌱</span>
      <div>
        <div className="t1">Növekedés ma</div>
        <div className="t2">{done}/{total} küldetés · +{xp} XP</div>
      </div>
      <span className="chev"><Icon name="chevron-right" size={16} /></span>
    </Link>
  )
}
