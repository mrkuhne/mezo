import type { NotificationForecast } from '@/features/me/logic/notificationForecast'

const HOUR_TICKS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]

/**
 * Direction C's "NAPI TERHELÉS" dark preview card (mockup §2C, design spec §7) — the live
 * daily-count + hourly sparkline that reacts to the category toggles below it. Presentational
 * only: takes the already-computed `forecastToday()` result as a prop, no `@/data/*` import.
 */
export function NotificationPreviewHeader({ forecast }: { forecast: NotificationForecast }) {
  const max = Math.max(1, ...forecast.perHour)
  const denseWindow = forecast.denseWindows[0] ?? null

  return (
    <div
      className="col gap-sm"
      style={{ background: 'linear-gradient(160deg, #2c2233, #3a2a2a)', borderRadius: 18, padding: '13px 14px' }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,.5)',
          }}
        >
          Napi terhelés
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,.75)' }}>
          {forecast.total} / nap
        </span>
      </div>

      <div className="row gap-xs" style={{ alignItems: 'flex-end', height: 38 }} data-testid="spark">
        {forecast.perHour.map((count, hour) => (
          <div
            key={hour}
            data-testid={`spark-bar-${hour}`}
            style={{
              flex: 1,
              borderRadius: '3px 3px 0 0',
              height: `${Math.max(8, (count / max) * 100)}%`,
              background: count > 0 ? 'linear-gradient(180deg, #FF9A7B, #FF5B36)' : 'rgba(255,255,255,.22)',
            }}
          />
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        {HOUR_TICKS.map((h) => (
          <span key={h} style={{ fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,.4)' }}>
            {h}
          </span>
        ))}
      </div>

      {denseWindow && (
        // NOT role="alert" — the page's push-subscription error banner already owns that role
        // (NotificationsPage asserts exactly one alert for a failed opt-in); a dense-window
        // note is informational, not an error, so data-testid is the honest hook for tests.
        <p data-testid="dense-window-warning" style={{ fontSize: 11, color: '#FFB347', margin: 0 }}>
          ⚠ Sűrű ablak — {denseWindow.fromHHmm} és {denseWindow.toHHmm} között {denseWindow.count} értesítés esne
        </p>
      )}
    </div>
  )
}
