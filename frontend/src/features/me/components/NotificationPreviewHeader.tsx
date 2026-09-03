import type { NotificationForecast } from '@/features/me/logic/notificationForecast'

const HOUR_TICKS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]

/**
 * Direction C's "NAPI TERHELÉS" dark preview card (mockup §2C, design spec §7; re-faced
 * mezo-d20.6.8 against en-body.html #page-ertesites .ntfprev, ×1.18) — the live daily-count
 * + hourly sparkline that reacts to the category toggles below it, recomputed live by the
 * caller's `forecastToday()` on every toggle. Presentational only: takes the already-computed
 * forecast as a prop, no `@/data/*` import.
 *
 * Deliberately dark in BOTH themes — the prototype's `.ntfprev` is a fixed nocturnal panel
 * (a phone-notification-shade metaphor), not a domain wash, so its hexes stay inline style
 * here rather than `--mz-*` tokens (which the Mozaik CSS guard requires to flip with theme).
 */
export function NotificationPreviewHeader({ forecast }: { forecast: NotificationForecast }) {
  const max = Math.max(1, ...forecast.perHour)
  const denseWindow = forecast.denseWindows[0] ?? null

  return (
    <div
      className="col gap-sm rise"
      style={{ background: 'linear-gradient(150deg, #2B2118, #201A14)', borderRadius: 21, padding: '14px 15px' }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase',
            color: 'rgba(232,224,213,.5)',
          }}
        >
          Napi terhelés
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(232,224,213,.85)', fontVariantNumeric: 'tabular-nums' }}>
          {forecast.total} / nap
        </span>
      </div>

      <div className="row gap-xs" style={{ alignItems: 'flex-end', height: 40, marginTop: 4 }} data-testid="spark">
        {forecast.perHour.map((count, hour) => (
          <div
            key={hour}
            data-testid={`spark-bar-${hour}`}
            style={{
              flex: 1,
              borderRadius: '2px 2px 0 0',
              minHeight: 2,
              height: `${Math.max(6, (count / max) * 100)}%`,
              background: count > 0 ? 'linear-gradient(180deg, #FF9A78, #E05535)' : 'rgba(232,224,213,.12)',
            }}
          />
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        {HOUR_TICKS.map((h) => (
          <span key={h} style={{ fontSize: 7, fontWeight: 600, color: '#7A6F63', fontVariantNumeric: 'tabular-nums' }}>
            {h}
          </span>
        ))}
      </div>

      {denseWindow && (
        // NOT role="alert" — the page's push-subscription error banner already owns that role
        // (NotificationsPage asserts exactly one alert for a failed opt-in); a dense-window
        // note is informational, not an error, so data-testid is the honest hook for tests.
        <p data-testid="dense-window-warning" style={{ fontSize: 10, color: '#FFB56B', margin: 0, fontWeight: 600 }}>
          ⚠ Sűrű ablak — {denseWindow.fromHHmm} és {denseWindow.toHHmm} között {denseWindow.count} értesítés esne
        </p>
      )}
    </div>
  )
}
