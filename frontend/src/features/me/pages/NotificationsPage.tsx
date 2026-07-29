import { useState } from 'react'
import { usePushSubscription } from '@/data/hooks'
import { PushInstallGate } from '@/features/me/components/PushInstallGate'
import { Toggle } from '@/shared/ui/Toggle'
import { CtaPrimary } from '@/shared/ui/Cta'
import type { PushErrorCode } from '@/data/types'

/** Honest, per-cause copy for a failed opt-in — a toggle that silently snaps back tells the
 *  user nothing and leaves nothing to diagnose. `vapid-missing` is called out separately
 *  because it is a BUILD misconfiguration (the exact state a fresh deploy hits), so the line
 *  has to point at the app rather than invite a pointless retry. */
const PUSH_ERROR_COPY: Record<PushErrorCode, string> = {
  'vapid-missing':
    'Ez a build nem kapott push-kulcsot, így az értesítések nem kapcsolhatók be. Ez alkalmazásoldali hiba — nem a te eszközöddel van gond.',
  'register-failed':
    'Az eszköz feliratkozott, de a szerver nem vette nyilvántartásba. Próbáld újra kicsit később.',
  failed: 'Az értesítések beállítása nem sikerült. Próbáld újra.',
}

/** Me → Értesítések (bd mezo-h4wp.6.1). N1 owns the master push opt-in + the iOS install
 *  gate + a test-push action; N2 adds the category list, N3 the volume-preview header.
 *
 *  `sendTest()` is deliberately NOT gated on `push.supported` — the backend endpoint fans
 *  out account-wide to every registered device, so this device's own capability is the
 *  wrong gate for it. Instead the *button's visibility* is gated on `push.enabled` (nothing
 *  to test before a subscription exists), and it's disabled while `push.busy`. */
export function NotificationsPage() {
  const push = usePushSubscription()
  const [testResult, setTestResult] = useState<string | null>(null)

  // iOS grants Web Push to home-screen-installed PWAs only: when the app is not standalone
  // (or the browser lacks Push support altogether) the toggle cannot work, so the install
  // instruction REPLACES it rather than sitting alongside a dead control.
  if (!push.supported || !push.standalone) {
    return (
      <div style={{ padding: '8px 24px 24px' }}>
        <div className="col gap-md">
          <PushInstallGate />
        </div>
      </div>
    )
  }

  // Derived honestly from what the hook can actually report — never invent a state it
  // doesn't surface (e.g. no "prompt" vs "default" distinction beyond what Notification.permission gives).
  const statusLine =
    push.permission === 'denied'
      ? 'Az eszközön letiltva — az iOS beállításokban engedélyezhető újra.'
      : push.enabled
        ? 'iPhone · engedélyezve'
        : 'Nincs engedélyezve'

  const onToggle = async () => {
    if (push.enabled) await push.unsubscribe()
    else await push.subscribe()
  }

  const onTest = async () => {
    const { attempted, sent } = await push.sendTest()
    setTestResult(
      sent > 0
        ? `Elküldve ${sent}/${attempted} eszközre.`
        : `Egyik eszköz sem fogadta el (${attempted} próbálkozás).`,
    )
  }

  return (
    <div style={{ padding: '8px 24px 24px' }}>
      <div className="col gap-md">
        <div className="card" style={{ padding: 14 }}>
          <div className="row gap-sm" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="col">
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Push értesítések
              </span>
              <span className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
                {statusLine}
              </span>
            </div>
            {/* Visible-but-inert when denied — the status line already tells the user it's
                recoverable in iOS settings, so the switch stays present and honestly marked
                dead rather than hidden (unlike an unrecoverable dead control, which would be
                hidden instead). Also disabled mid-flight to prevent re-entrant taps. */}
            <Toggle
              on={push.enabled}
              onToggle={onToggle}
              ariaLabel="Push értesítések"
              disabled={push.busy || push.permission === 'denied'}
            />
          </div>
          {/* The whole point of the hook's `error`: without this line a failed subscribe is a
              toggle that flips back to off with the status line still reading „Nincs
              engedélyezve" — indistinguishable from a tap that never registered. */}
          {push.error && (
            <p className="text-error" style={{ fontSize: 11, marginTop: 10 }} role="alert">
              {PUSH_ERROR_COPY[push.error]}
            </p>
          )}
        </div>

        {push.enabled && (
          <div className="card" style={{ padding: 14 }}>
            <CtaPrimary onClick={onTest} disabled={push.busy}>
              Teszt értesítés küldése
            </CtaPrimary>
            {testResult && (
              <p className="text-tertiary" style={{ fontSize: 11, marginTop: 8 }}>
                {testResult}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
