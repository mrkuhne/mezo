import type { AppNotificationView } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'

export interface FeedGroup {
  label: 'Ma' | 'Tegnap' | 'Korábban'
  items: AppNotificationView[]
}

/** Day-buckets the feed for the panel. `today` is injectable for pure tests
 *  (`localDateString()` at the call site). Items arrive newest-first and stay that way. */
export function groupByDay(items: AppNotificationView[], today: string): FeedGroup[] {
  const todayDate = new Date(`${today}T00:00:00`)
  const yesterday = new Date(todayDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = localDateString(yesterday)

  const buckets: Record<FeedGroup['label'], AppNotificationView[]> = { Ma: [], Tegnap: [], Korábban: [] }
  for (const n of items) {
    const day = localDateString(new Date(n.occurredAt))
    if (day === today) buckets.Ma.push(n)
    else if (day === yesterdayStr) buckets.Tegnap.push(n)
    else buckets.Korábban.push(n)
  }
  return (['Ma', 'Tegnap', 'Korábban'] as const)
    .filter((label) => buckets[label].length > 0)
    .map((label) => ({ label, items: buckets[label] }))
}
