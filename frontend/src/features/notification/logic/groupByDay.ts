import type { AppNotificationView } from '@/data/types'
import { addDays, localDateString } from '@/shared/lib/dates'

export interface FeedGroup {
  /** `Ma` · `Tegnap` · vagy a nap saját dátum-címkéje (`aug. 15.`). */
  label: string
  items: AppNotificationView[]
}

const dateLabel = (occurredAt: string) =>
  new Date(occurredAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })

/** Day-buckets the feed. `today` is injectable for pure tests (`localDateString()` at the call
 *  site). A „Korábban" gyűjtőbucket helyett minden régebbi nap SAJÁT dátum-címkét kap
 *  (mezo-nol0): a 3 soros dropdownban egy gyűjtőcím elég volt, a teljes oldalon nem. A rendezés
 *  itt történik, nem a hívónál — ISO-időbélyegek lexikografikus sorrendje = időrend. */
export function groupByDay(items: AppNotificationView[], today: string): FeedGroup[] {
  const yesterday = addDays(today, -1)
  const sorted = [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  // Map: a beszúrási sorrend = a rendezett sorrend, tehát a csoportok maguktól csökkenőek.
  // KULCS a naptári nap (pl. „2025-08-15"), NEM a megjelenített címke: két, pontosan egy évre
  // lévő elem ugyanazt az „aug. 15." címkét kapná, de a csoport IDENTITÁSA nem eshet egybe
  // (mezo-nol0).
  const byDay = new Map<string, FeedGroup>()
  for (const n of sorted) {
    const day = localDateString(new Date(n.occurredAt))
    const label = day === today ? 'Ma' : day === yesterday ? 'Tegnap' : dateLabel(n.occurredAt)
    const group = byDay.get(day)
    if (group) group.items.push(n)
    else byDay.set(day, { label, items: [n] })
  }
  return [...byDay.values()]
}
