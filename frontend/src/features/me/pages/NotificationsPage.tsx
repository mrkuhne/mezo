import { useSettingsOrigin } from '@/features/settings/components/SettingsFrame'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  usePushSubscription,
  useNotificationPrefs,
  useCheckins,
  useStack,
  useProtocol,
  useIntakes,
  useFuelSettings,
  useSleepGoal,
  useTrain,
  useRunning,
  useRitualDay,
  useMedication,
} from '@/data/hooks'
import { PushInstallGate } from '@/features/me/components/PushInstallGate'
import { NotificationPreviewHeader } from '@/features/me/components/NotificationPreviewHeader'
import { NotificationCategoryRow } from '@/features/me/components/NotificationCategoryRow'
import { Toggle } from '@/shared/ui/Toggle'
import { CtaPrimary } from '@/shared/ui/Cta'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon3D } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { deriveBlocks } from '@/features/fuel/logic/buildProtocol'
import { projectStackDay } from '@/features/fuel/logic/projectStackDay'
import { buildScheduleEntries } from '@/data/notification/notificationScheduleWriter'
import { forecastToday, type NotificationForecastAnchors } from '@/features/me/logic/notificationForecast'
import { localDateString } from '@/shared/lib/dates'
import { NOTIFICATION_CATEGORY_META } from '@/data/types'
import type { NotificationCategoryKey, PushErrorCode } from '@/data/types'
import { useM, type Messages } from '@/shared/i18n'

/** Honest, per-cause copy for a failed opt-in — a toggle that silently snaps back tells the
 *  user nothing and leaves nothing to diagnose. `vapid-missing` is called out separately
 *  because it is a BUILD misconfiguration (the exact state a fresh deploy hits), so the line
 *  has to point at the app rather than invite a pointless retry. The text is the current
 *  language's catalog text, looked up at render time (never captured at module load). */
function pushErrorCopy(code: PushErrorCode, t: Messages['settings']['notifications']): string {
  return code === 'vapid-missing' ? t.pushErrorVapid : code === 'register-failed' ? t.pushErrorRegister : t.pushErrorFailed
}

/** ISO 1=Mon..7=Sun, converted from JS's 0=Sun..6=Sat. */
function isoWeekday(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

/** The anchors a live sub-line can be derived from — every field the settings page already
 *  reads for the preview header (fix round 1, mezo-h4wp.6.3 review): the sub-line the user
 *  reads must never disagree with the number the header/forecast use. */
interface SubLineContext {
  wake: string
  bedTime: string
  ritualOpensAt: string
  ritualPrepStartsAt: string
  gymBlock: { time: string; label: string } | null
  medicationDay: boolean
  medCycleDay: number
  fuelSlotCount: number
  todayName: string
}

/**
 * A live, per-day sub-line derived from data the page already has — the mockup's direction-C
 * rows show exactly these ("ma 17:00 · Láb nap", "21:00 · ablak nyílása", "szerda · D1"), not
 * the generic copy in `NOTIFICATION_CATEGORY_META`. Falls back to the static `fallback`
 * (that meta description) for `midday`/`memoir` (their anchors are fixed backend CONSTANTS —
 * 12:30 / Sunday 19:00 — not per-day user data, so there is nothing to derive) and for `gym`/
 * `medication` on a day where the anchor is genuinely absent (no session today / not a dose
 * day) — an honest fallback, never an invented time. `checkin`'s static description already
 * IS the derived value (the four fixed slot times never vary), so it needs no special case.
 * `weekly_review` is a fixed backend constant too (Monday 10:00, mezo-p2tr) — its static
 * `NOTIFICATION_CATEGORY_META` description already IS the derived value, unlike the retired
 * `weekly`'s wake-anchored one, so it needs no case here either.
 */
function deriveSubLine(category: NotificationCategoryKey, fallback: string, ctx: SubLineContext, t: Messages['settings']['notifications']): string {
  switch (category) {
    case 'briefing':
      return t.subBriefing(ctx.wake)
    case 'gym':
      return ctx.gymBlock ? t.subGym(ctx.gymBlock.time, ctx.gymBlock.label) : fallback
    case 'ritual':
      return t.subRitual(ctx.ritualOpensAt)
    case 'lights_out':
      return ctx.bedTime
    case 'wind_down':
      return ctx.ritualPrepStartsAt
    case 'medication':
      return ctx.medicationDay ? t.subMedication(ctx.todayName, ctx.medCycleDay) : fallback
    case 'fuel_slot':
      return ctx.fuelSlotCount > 0 ? t.subFuelSlots(ctx.fuelSlotCount) : fallback
    default:
      return fallback
  }
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
  const m = useM()
  const t = m.settings.notifications
  const navigate = useNavigate()
  const origin = useSettingsOrigin()
  const push = usePushSubscription()
  const { prefs, setPref } = useNotificationPrefs()
  // The raw outcome, never the sentence: the sentence is built at render so it follows the language.
  const [testResult, setTestResult] = useState<{ sent: number; attempted: number } | null>(null)

  // ── Preview-header + sub-line inputs (N3, design spec §7) — every hook called
  // unconditionally, before the install-gate's early return, per the rules of hooks. ─────────
  const { checkins } = useCheckins()
  const { stash } = useStack()
  const { occurrences } = useProtocol()
  const intakes = useIntakes(localDateString())
  const { settings } = useFuelSettings()
  const { goal: sleepGoal } = useSleepGoal()
  const { gymSchedule, sport, plannedSkips } = useTrain()
  const { activeRunningBlock } = useRunning()
  const { data: ritualDay } = useRitualDay(localDateString())
  const { cycle: medicationCycle } = useMedication()

  // Today's earliest gym/sport block (AnchorResolver's `gym` category anchors on
  // gym_schedule_slot + sport_schedule_slot only — never a running block). `null` = nothing
  // scheduled today → both the forecast and the row sub-line honestly fall back rather than
  // inventing a time.
  const blocks = deriveBlocks(gymSchedule, sport, activeRunningBlock, plannedSkips)
  const gymBlock = blocks
    .filter((b) => b.kind === 'gym' || b.kind === 'sport')
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))[0] ?? null

  // The occurrence-based projection (mezo-vx9v Task 9) — the SAME `projectStackDay` composition
  // the "Mai" timeline and the Stack page use, fed this page's own already-fetched sources, so
  // the pre-workout time this page shows in the forecast can never disagree with what gets
  // persisted to notification_schedule.
  const protocolSlots = projectStackDay({
    occurrences, stash, intakes, wake: sleepGoal.wakeTime, bed: sleepGoal.bedTime,
    mealsPerDay: settings.mealsPerDay, blocks,
  })
  const scheduleEntries = buildScheduleEntries(checkins, protocolSlots)

  const forecastAnchors: NotificationForecastAnchors = {
    wake: sleepGoal.wakeTime,
    bedTime: sleepGoal.bedTime,
    gymTime: gymBlock?.time ?? null,
    ritualOpensAt: ritualDay.window.opensAt,
    ritualPrepStartsAt: ritualDay.window.prepStartsAt,
    medicationDay: medicationCycle.cycleDay > 0,
  }
  const weekday = isoWeekday(new Date())
  const forecast = forecastToday(prefs, scheduleEntries, forecastAnchors, weekday)

  const subLineCtx: SubLineContext = {
    wake: sleepGoal.wakeTime,
    bedTime: sleepGoal.bedTime,
    ritualOpensAt: ritualDay.window.opensAt,
    ritualPrepStartsAt: ritualDay.window.prepStartsAt,
    gymBlock,
    medicationDay: medicationCycle.cycleDay > 0,
    medCycleDay: medicationCycle.cycleDay,
    // A zone whose every entry is rest-day-skipped never renders as a stack card (mirrors
    // buildDayPlan's FuelSlot mapper) — the count the user reads here must match what actually
    // shows up in the "Mai" timeline, not the raw zone count.
    fuelSlotCount: protocolSlots.filter((s) => s.entries.some((e) => !e.skippedToday)).length,
    todayName: t.weekday(new Date().getDay()),
  }

  // iOS grants Web Push to home-screen-installed PWAs only: when the app is not standalone
  // (or the browser lacks Push support altogether) the toggle cannot work, so the install
  // instruction REPLACES the entire screen — preview header and category list included. A
  // volume preview for a channel that cannot fire yet, or a settings list for it, would both
  // be offering controls for something the platform has already ruled out.
  if (!push.supported || !push.standalone) {
    return (
      // The gate keeps the page's own Mozaik scaffold — ADR 0032: without the `‹ Értesítések`
      // chip the gate was a dead end with no way back (the page had no header at all before
      // mezo-d20.11; mezo-nol0 renamed the chip once the feed took the shared noun).
      // No hero bignum here: on a platform where nothing can fire, a "5 tervezett ma" would be
      // a number about notifications that cannot happen.
      <MozaikPage tone="sky" className="ntf-page">
        <PageHead glass onBack={() => navigate('/settings', { state: origin.state })} label={m.settings.frame.settings} />
        <PageHero art="t-bell" accent="var(--dv-sky)" name={t.pageName} />
        <PageBody>
          <EntranceGroup className="col gap-md">
            <div className="rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <PushInstallGate />
            </div>
          </EntranceGroup>
        </PageBody>
      </MozaikPage>
    )
  }

  // Derived honestly from what the hook can actually report — never invent a state it
  // doesn't surface (e.g. no "prompt" vs "default" distinction beyond what Notification.permission gives).
  const statusLine =
    push.permission === 'denied'
      ? t.statusDenied
      : push.enabled
        ? t.statusOn
        : t.statusOff

  const onToggle = async () => {
    if (push.enabled) await push.unsubscribe()
    else await push.subscribe()
  }

  const onTest = async () => {
    const { attempted, sent } = await push.sendTest()
    setTestResult({ sent, attempted })
  }

  const proseCategories = prefs.filter((p) => NOTIFICATION_CATEGORY_META[p.category].section === 'prose')
  const reminderCategories = prefs.filter((p) => NOTIFICATION_CATEGORY_META[p.category].section === 'reminder')
  const brainCategories = prefs.filter((p) => NOTIFICATION_CATEGORY_META[p.category].section === 'brain')

  return (
    <MozaikPage tone="sky" className="ntf-page">
      <PageHead glass onBack={() => navigate('/settings', { state: origin.state })} label={m.settings.frame.settings} />
      {/* Prototype #page-ertesites: the hero states today's planned volume, and the sub-line
          qualifies the rhythm. „nyugodt ritmus" is DERIVED (no dense window in the same
          forecast the card below draws), never asserted — a crowded day says so instead. */}
      <PageHero
        art="t-bell"
        accent="var(--dv-sky)"
        name={t.pageName}
        big={forecast.total}
        sub={forecast.denseWindows.length === 0 ? t.subCalm : t.subBusy}
      />
      <PageBody>
      <EntranceGroup className="col gap-md">
        <NotificationPreviewHeader forecast={forecast} />

        {/* Üveg (mezo-me75u.7): the master switch is its own one-row sky glass card. */}
        <div className="ntf-masterrow glass rise" style={{ '--d': '40ms', '--c': 'var(--dv-sky)' } as React.CSSProperties}>
          <span className="ntf-mic uv-well" aria-hidden="true"><Icon3D name="t-bell" size={28} /></span>
          <div className="ntf-master-tx">
            <span className="ntf-master-nm">{t.push}</span>
            <span className="ntf-master-sb">{statusLine}</span>
          </div>
          {/* Visible-but-inert when denied — the status line already tells the user it's
              recoverable in iOS settings, so the switch stays present and honestly marked
              dead rather than hidden (unlike an unrecoverable dead control, which would be
              hidden instead). Also disabled mid-flight to prevent re-entrant taps. */}
          <Toggle
            glass
            on={push.enabled}
            onToggle={onToggle}
            ariaLabel={t.push}
            disabled={push.busy || push.permission === 'denied'}
          />
        </div>
        {/* The whole point of the hook's `error`: without this line a failed subscribe is a
            toggle that flips back to off with the status line still reading „Nincs
            engedélyezve" — indistinguishable from a tap that never registered. Lives outside
            the washed row (an alert reads oddly nested in a colored tile). */}
        {push.error && (
          <p className="text-error ntf-err" role="alert">
            {pushErrorCopy(push.error, t)}
          </p>
        )}

        {push.enabled && (
          <div className="ntf-testrow rise" style={{ '--d': '70ms' } as React.CSSProperties}>
            <CtaPrimary className="ntf-testbtn" onClick={onTest} disabled={push.busy}>
              <Icon3D name="t-send" size={22} />
              {t.sendTest}
            </CtaPrimary>
            {testResult && (
              <p className="text-tertiary ntf-testres">
                {testResult.sent > 0 ? t.testSent(testResult.sent, testResult.attempted) : t.testRefused(testResult.attempted)}
              </p>
            )}
          </div>
        )}

        <div className="rise" style={{ '--d': '100ms' } as React.CSSProperties}>
          <Eyebrow>{t.prose}</Eyebrow>
          <div className="ntf-cats glass" style={{ '--c': 'var(--dv-sky)' } as React.CSSProperties}>
            {proseCategories.map((pref) => (
              <NotificationCategoryRow
                key={pref.category}
                pref={pref}
                subLine={deriveSubLine(pref.category, t.categories[pref.category].description, subLineCtx, t)}
                onToggle={() => setPref(pref.category, { enabled: !pref.enabled })}
              />
            ))}
          </div>
        </div>

        <div className="rise" style={{ '--d': '140ms' } as React.CSSProperties}>
          <Eyebrow>{t.reminders}</Eyebrow>
          <div className="ntf-cats glass" style={{ '--c': 'var(--dv-sky)' } as React.CSSProperties}>
            {reminderCategories.map((pref) => (
              <NotificationCategoryRow
                key={pref.category}
                pref={pref}
                subLine={deriveSubLine(pref.category, t.categories[pref.category].description, subLineCtx, t)}
                onToggle={() => setPref(pref.category, { enabled: !pref.enabled })}
              />
            ))}
          </div>
        </div>

        <div className="rise" style={{ '--d': '180ms' } as React.CSSProperties}>
          <Eyebrow>{t.brain}</Eyebrow>
          <div className="ntf-cats glass" style={{ '--c': 'var(--dv-sky)' } as React.CSSProperties}>
            {brainCategories.map((pref) => (
              <NotificationCategoryRow
                key={pref.category}
                pref={pref}
                subLine={deriveSubLine(pref.category, t.categories[pref.category].description, subLineCtx, t)}
                onToggle={() => setPref(pref.category, { enabled: !pref.enabled })}
              />
            ))}
          </div>
          <p className="ntf-foot">{t.brainFoot}</p>
        </div>
      </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
