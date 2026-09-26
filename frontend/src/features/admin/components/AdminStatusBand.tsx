import { useNavigate } from 'react-router-dom'
import { useMe } from '@/data/hooks'
import { useAdminAlerts } from '@/data/admin/adminInsightsHooks'
import { featureLabel } from '@/features/admin/lib/labels'
import { cn } from '@/shared/lib/cn'
import { Icon3D } from '@/shared/ui/clay'

// Small Hungarian ordinals for the headline count — beyond 5 the raw numeral reads fine.
const HUN_COUNT: Record<number, string> = { 1: 'Egy', 2: 'Két', 3: 'Három', 4: 'Négy', 5: 'Öt' }

// Status band (mezo-l096 §1): the ONE place the admin says "baj van" / "minden rendben".
// Self-contained — derives its own `isOwner` (the `useMe`/`role === 'OWNER'` recipe every
// admin page repeats, see AdminOverviewPage.tsx) and calls `useAdminAlerts` itself, so any
// page can drop this in without threading props through.
//
// State order matters: isError is checked BEFORE isPending/empty so a failed check can never
// be mistaken for the pending placeholder, and isPending is checked BEFORE "no alerts" so a
// real-mode cold load (which resolves to a zeroed `realEmpty` while in flight — see
// useDualQuery's own doc comment) can never flash the green all-good state. Error state is
// grey and explicit — a failed check must never look like a green all-clear.
export function AdminStatusBand() {
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const alerts = useAdminAlerts(isOwner)
  const navigate = useNavigate()

  if (alerts.isError) {
    return (
      // Üveg (mezo-me75u.10): unavailable stays a NEUTRAL flat cell (never green, never glass) —
      // a failed check is "unknown", not an alarm; the ⓘ icon carries it.
      <div className="ad-status off">
        <Icon3D name="t-info" size={24} className="ad-status-ic" />
        <span className="headline">Az ellenőrzés most nem fut</span>
      </div>
    )
  }

  if (alerts.isPending) {
    return (
      <div className="ad-status off is-pending" aria-busy="true" aria-label="Betöltés…">
        <span className="headline" aria-hidden="true">Betöltés…</span>
      </div>
    )
  }

  const items = alerts.data.alerts

  if (items.length === 0) {
    return (
      <div className="ad-status allok glass">
        <Icon3D name="t-shield" size={34} className="ad-status-ic" />
        <h3>Minden rendben</h3>
      </div>
    )
  }

  const headline = items.length === 1
    ? 'Egy dolog figyelmet kér'
    : `${HUN_COUNT[items.length] ?? items.length} dolog figyelmet kér`

  return (
    // Primary object of the page: a glass band whose ONE accent is the worst severity present.
    <div
      className="ad-status glass"
      data-worst={items.some((a) => a.severity === 'bad') ? 'bad' : items.some((a) => a.severity === 'warn') ? 'warn' : 'info'}
    >
      <div className="headline">{headline}</div>
      <div className="ad-alertrow">
        {items.map((a) => (
          <button
            // Final review F1: `llm_errors` emits one alert PER feature — all sharing the SAME
            // `key` ("llm_errors") with only `subject` (the feature slug) distinguishing them.
            // `a.key` alone collided into duplicate React keys; `subject` is optional on other
            // rule keys (e.g. cost_spike), so it's appended rather than relied on alone.
            key={`${a.key}:${a.subject ?? ''}`}
            type="button"
            className={cn('ad-alert', a.severity)}
            onClick={() => navigate(a.link)}
            title={a.detail}
          >
            <i aria-hidden />
            <span>{a.subject ? `${featureLabel(a.subject).label}: ` : ''}{a.title}</span>
            <span className="go">Megnézem →</span>
          </button>
        ))}
      </div>
    </div>
  )
}
