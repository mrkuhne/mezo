import { addDays, localDateString } from '@/shared/lib/dates'
import { m } from '@/shared/i18n'
import { locale } from '@/shared/lib/format'

/** `Ma` · `Tegnap` · vagy a nap saját dátum-címkéje (`aug. 15.`). A relatív ág a NAPTÁRI napra
 *  kapuz (`localDateString`), nem a címkére: két, pontosan egy évre lévő nap ugyanazt az
 *  „aug. 18." címkét adná, de csak az egyik a mai. `today` injektálható a tiszta tesztekhez. */
export function dayLabel(occurredAt: string, today: string = localDateString()): string {
  const day = localDateString(new Date(occurredAt))
  if (day === today) return m().frame.titleBar.panel.today
  if (day === addDays(today, -1)) return m().frame.titleBar.panel.yesterday
  return new Date(occurredAt).toLocaleDateString(locale(), { month: 'short', day: 'numeric' })
}

export const timeLabel = (occurredAt: string) =>
  new Date(occurredAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })

/** Egysoros időbélyeg (`Ma · 06:12`, `aug. 15. · 19:05`) azoknak a felületeknek, ahol nincs
 *  napcsoport-fejléc, ami a dátumot hordozná — a fejléc csengő-peekje ilyen. A teljes feed
 *  oldalon a nap a `<h2>` csoportcímke, ott a puszta `timeLabel` a helyes. */
export const notificationStamp = (occurredAt: string, today?: string) =>
  `${dayLabel(occurredAt, today)} · ${timeLabel(occurredAt)}`
