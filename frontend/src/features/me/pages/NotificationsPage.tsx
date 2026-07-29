import { useState } from 'react'
import {
  usePushSubscription,
  useNotificationPrefs,
  useCheckins,
  useStack,
  useProtocol,
  useSleepGoal,
  useTrain,
  useRitualDay,
  useMedication,
} from '@/data/hooks'
import { PushInstallGate } from '@/features/me/components/PushInstallGate'
import { NotificationPreviewHeader } from '@/features/me/components/NotificationPreviewHeader'
import { NotificationCategoryRow } from '@/features/me/components/NotificationCategoryRow'
import { Toggle } from '@/shared/ui/Toggle'
import { CtaPrimary } from '@/shared/ui/Cta'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { buildProtocol, type ProtocolAnchors } from '@/features/fuel/logic/buildProtocol'
import { buildScheduleEntries } from '@/data/notification/notificationScheduleWriter'
import { forecastToday, type NotificationForecastAnchors } from '@/features/me/logic/notificationForecast'
import { localDateString } from '@/shared/lib/dates'
import { NOTIFICATION_CATEGORY_META } from '@/data/types'
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

/** ISO 1=Mon..7=Sun, converted from JS's 0=Sun..6=Sat. */
function isoWeekday(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

/** Me → Értesítések (bd mezo-h4wp.6.1/.2/.3). N1 owns the master push opt-in + the iOS
 *  install gate + a test-push action; N2 adds the settings category list (below); N3 adds the
 *  live volume-preview header (above) + the app-open schedule snapshot (AppLayout.tsx).
 *
 *  `sendTest()` is deliberately NOT gated on `push.supported` — the backend endpoint fans
 *  out account-wide to every registered device, so this device's own capability is the
 *  wrong gate for it. Instead the *button's visibility* is gated on `push.enabled` (nothing
 *  to test before a subscription exists), and it's disabled while `push.busy`. */
export function NotificationsPage() {
  const push = usePushSubscription()
  const { prefs, setPref } = useNotificationPrefs()
  const [testResult, setTestResult] = useState<string | null>(null)

  // ── Preview-header inputs (N3, design spec §7) — every hook called unconditionally, before
  // the install-gate's early return, per the rules of hooks. ────────────────────────────────
  const { checkins } = useCheckins()
  const { stash } = useStack()
  const { selectedIds } = useProtocol()
  const { goal: sleepGoal } = useSleepGoal()
  const { gymSchedule } = useTrain()
  const { data: ritualDay } = useRitualDay(localDateString())
  const { cycle: medicationCycle } = useMedication()

  const protocolSelection = selectedIds ?? stash.filter((s) => s.type !== 'medication').map((s) => s.id)
  const protocolAnchors: ProtocolAnchors = { wake: sleepGoal.wakeTime, bedtime: sleepGoal.bedTime }
  const protocolSlots = buildProtocol(protocolSelection, stash, protocolAnchors).slots
  const scheduleEntries = buildScheduleEntries(checkins, protocolSlots)

  // Today's earliest active gym slot (mirrors AnchorResolver's gym-family read, sport-slots
  // aside — a deliberate simplification, see the task report). `null` = nothing scheduled
  // today → the forecast honestly skips `gym` rather than inventing a time.
  const gymTime = gymSchedule?.weeklyTimes.find((d) => d.today && d.active && d.time)?.time ?? null

  const forecastAnchors: NotificationForecastAnchors = {
    wake: sleepGoal.wakeTime,
    bedTime: sleepGoal.bedTime,
    gymTime,
    ritualOpensAt: ritualDay.window.opensAt,
    ritualPrepStartsAt: ritualDay.window.prepStartsAt,
    medicationDay: medicationCycle.retaDay > 0,
  }
  const weekday = isoWeekday(new Date())
  const forecast = forecastToday(prefs, scheduleEntries, forecastAnchors, weekday)

  // iOS grants Web Push to home-screen-installed PWAs only: when the app is not standalone
  // (or the browser lacks Push support altogether) the toggle cannot work, so the install
  // instruction REPLACES the entire screen — preview header and category list included. A
  // volume preview for a channel that cannot fire yet, or a settings list for it, would both
  // be offering controls for something the platform has already ruled out.
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

  const proseCategories = prefs.filter((p) => NOTIFICATION_CATEGORY_META[p.category].section === 'prose')
  const reminderCategories = prefs.filter((p) => NOTIFICATION_CATEGORY_META[p.category].section === 'reminder')

  return (
    <div style={{ padding: '8px 24px 24px' }}>
      <div className="col gap-md">
        <NotificationPreviewHeader forecast={forecast} />

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

        <div>
          <Eyebrow>Mezo megszólal</Eyebrow>
          <div className="card" style={{ padding: '0 14px', marginTop: 8 }}>
            {proseCategories.map((pref) => (
              <NotificationCategoryRow
                key={pref.category}
                pref={pref}
                onToggle={() => setPref(pref.category, { enabled: !pref.enabled })}
              />
            ))}
          </div>
        </div>

        <div>
          <Eyebrow>Emlékeztetők</Eyebrow>
          <div className="card" style={{ padding: '0 14px', marginTop: 8 }}>
            {reminderCategories.map((pref) => (
              <NotificationCategoryRow
                key={pref.category}
                pref={pref}
                onToggle={() => setPref(pref.category, { enabled: !pref.enabled })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
