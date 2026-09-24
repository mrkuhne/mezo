import type { CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import type { NotificationForecast } from '@/features/me/logic/notificationForecast'

const HOUR_TICKS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]

/** "HH:mm" → its hour bucket (0..23). */
const hourOf = (hhmm: string) => Number(hhmm.slice(0, 2))

/**
 * Direction C's "NAPI TERHELÉS" preview card (mockup §2C, design spec §7) — the live daily-count
 * + hourly sparkline that reacts to the category toggles below it, recomputed live by the
 * caller's `forecastToday()` on every toggle. Presentational only: takes the already-computed
 * forecast as a prop, no `@/data/*` import.
 *
 * Üveg (mezo-me75u.7, prototypes/uveg-en2.html `bert()`): a sky glass card; the hours that carry
 * a notification are lit sky bars, the hours inside a dense window are coral — the colour says
 * where the crowding is, not just that there is some. The skin lives in the page's üveg block
 * (`.ntf-prev`), no inline hexes.
 */
export function NotificationPreviewHeader({ forecast }: { forecast: NotificationForecast }) {
  const max = Math.max(1, ...forecast.perHour)
  const denseWindow = forecast.denseWindows[0] ?? null
  const inDense = (hour: number) =>
    forecast.denseWindows.some((w) => hour >= hourOf(w.fromHHmm) && hour <= hourOf(w.toHHmm))

  return (
    <div className="ntf-prev glass rise" style={{ '--c': 'var(--dv-sky)' } as CSSProperties}>
      <div className="ntf-prev-top">
        <span className="ntf-prev-eb">Napi terhelés</span>
        <span className="ntf-prev-total">{forecast.total} / nap</span>
      </div>

      <div className="ntf-prev-bars" data-testid="spark">
        {forecast.perHour.map((count, hour) => (
          <i
            key={hour}
            data-testid={`spark-bar-${hour}`}
            className={cn(count > 0 && (inDense(hour) ? 'hot' : 'on'))}
            style={{ height: `${Math.max(6, (count / max) * 100)}%` }}
          />
        ))}
      </div>

      <div className="ntf-prev-axis" aria-hidden="true">
        {HOUR_TICKS.map((h) => <span key={h}>{h}</span>)}
      </div>

      {denseWindow && (
        // NOT role="alert" — the page's push-subscription error banner already owns that role
        // (NotificationsPage asserts exactly one alert for a failed opt-in); a dense-window
        // note is informational, not an error, so data-testid is the honest hook for tests.
        // The old ⚠ glyph is the 3D info icon; "Sűrű ablak" carries the meaning in words.
        <p className="ntf-prev-warn" data-testid="dense-window-warning">
          <Icon3D name="t-info" size={20} />
          <span>Sűrű ablak — {denseWindow.fromHHmm} és {denseWindow.toHHmm} között {denseWindow.count} értesítés esne</span>
        </p>
      )}
    </div>
  )
}
