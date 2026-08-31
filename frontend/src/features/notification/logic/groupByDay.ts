import type { AppNotificationView } from '@/data/types'
import { addDays, localDateString } from '@/shared/lib/dates'

export interface FeedGroup {
  /** `Ma` · `Tegnap` · vagy a nap saját dátum-címkéje (`aug. 15.`). */
  label: string
  /** A csoport naptári napja (`YYYY-MM-DD`) — stabil React `key`-nek, mert a `label` egy évvel
   *  eltérő napokra is ugyanaz lehet (mezo-nol0). */
  day: string
  items: AppNotificationView[]
}

const dateLabel = (occurredAt: string) =>
  new Date(occurredAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })

/** Day-buckets the feed. `today` is injectable for pure tests (`localDateString()` at the call
 *  site). A „Korábban" gyűjtőbucket helyett minden régebbi nap SAJÁT dátum-címkét kap
 *  (mezo-nol0): a 3 soros dropdownban egy gyűjtőcím elég volt, a teljes oldalon nem. A rendezés
 *  a felbontott időpontra (`Date.parse`) épül, nem az ISO-string lexikografikus sorrendjére: a
 *  mock mód `toISOString()`-je mindig egyenletes felbontású, de az éles backend `occurredAt`-ja
 *  vegyes felbontással érkezhet, ahol a stringrendezés visszafelé sorolna. */
export function groupByDay(items: AppNotificationView[], today: string): FeedGroup[] {
  const yesterday = addDays(today, -1)
  const sorted = [...items].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
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
    else byDay.set(day, { label, day, items: [n] })
  }
  return [...byDay.values()]
}
