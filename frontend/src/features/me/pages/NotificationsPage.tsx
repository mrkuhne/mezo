import { useState } from 'react'
import { usePushSubscription } from '@/data/hooks'
import { PushInstallGate } from '@/features/me/components/PushInstallGate'
import { Toggle } from '@/shared/ui/Toggle'
import { CtaPrimary } from '@/shared/ui/Cta'

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
    // A denied permission can't be flipped back on from here (iOS won't re-prompt), and a
    // busy in-flight request must not be re-entered — guard both rather than fire again.
    if (push.busy || push.permission === 'denied') return
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
            <Toggle on={push.enabled} onToggle={onToggle} ariaLabel="Push értesítések" />
          </div>
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
