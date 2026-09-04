import { useEffect, useRef } from 'react'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { notificationApi } from '@/data/notification/notificationApi'
import { initialCheckins } from '@/data/today/checkins'
import { useStack, useProtocol, useIntakes } from '@/data/fuel/stackHooks'
import { useFuelSettings } from '@/data/fuel/fuelSettingsHooks'
import { useSleepGoal } from '@/data/me/sleepHooks'
import { useTrain } from '@/data/train/trainHooks'
import { useRunning } from '@/data/train/runningHooks'
import { deriveBlocks } from '@/features/fuel/logic/buildProtocol'
import { projectStackDay, type StackDaySlot } from '@/features/fuel/logic/projectStackDay'
import type { components } from '@/data/_client/api.gen'
import type { CheckinSlot } from '@/data/types'

type NotificationScheduleEntry = components['schemas']['NotificationScheduleEntry']

const MAX_TITLE_CHARS = 120
const MAX_BODY_CHARS = 300
const CHECKIN_BODY = 'Hogy vagy most? Energia, stressz, test, fej — 20 másodperc.'
const FUEL_DEEPLINK = '/fuel/stack'

/**
 * The real check-in sheet mounts on `/today` (CheckInSheet) — but the deeplink carries the slot's
 * own time as a query param so the FOUR daily slots get four DISTINCT urls. `push-sw.js` uses
 * `data.url` as the notification `tag`, and iOS/Chrome REPLACE a shown notification that shares a
 * tag: with a bare `/today` on every slot, the 10:00 check-in silently wiped an undismissed 06:30
 * one (and collided with `briefing`/`wind_down`/`midday`, which also deeplink to `/today`).
 * Distinct urls is the smaller, safer fix than changing the worker's tag strategy.
 *
 * `useTodayScenario` reads only its own named params (`day`/`medCycleDay`/`niggle`/`vulnerable`/
 * `ritual`) and React Router matches on the path, so `?checkin=` is harmlessly IGNORED today —
 * it is a tag discriminator, not a feature. Opening the check-in sheet from it would be genuinely
 * useful and is deliberately NOT built here.
 */
function checkinDeeplink(time: string): string {
  return `/today?checkin=${time}`
}

/** Human label per `projectStackDay` zone — mirrors the mockup's "Stack · reggeli slot" style
 *  titles without re-deriving the slot's meaning; falls back to the raw zone key for any future
 *  zone `StackZoneKey` might add, so a new slot never renders as `undefined`. */
const FUEL_WINDOW_LABEL: Record<string, string> = {
  wake: 'ébredési', breakfast: 'reggeli', pre_workout: 'edzés előtti', post_workout: 'edzés utáni',
  lunch: 'ebédi', dinner: 'vacsora melletti', evening: 'esti', bedtime: 'lefekvés előtti',
}

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars)
}

function checkinEntry(slot: Pick<CheckinSlot, 'time'>): NotificationScheduleEntry {
  return {
    weekday: null, // check-ins recur every day
    time: slot.time,
    category: 'checkin',
    title: truncate(`Check-in · ${slot.time}`, MAX_TITLE_CHARS),
    body: truncate(CHECKIN_BODY, MAX_BODY_CHARS),
    deeplink: checkinDeeplink(slot.time),
    source: 'checkinSlots',
  }
}

function fuelSlotEntry(slot: StackDaySlot): NotificationScheduleEntry {
  const label = FUEL_WINDOW_LABEL[slot.zone] ?? slot.zone
  const body = slot.entries
    .filter((e) => !e.skippedToday)
    .map((e) => (e.dose ? `${e.name} ${e.dose}` : e.name))
    .join(' + ')
  return {
    weekday: null, // fuel/stack slots recur every day
    time: slot.time,
    category: 'fuel_slot',
    title: truncate(`Stack · ${label} slot`, MAX_TITLE_CHARS),
    body: truncate(body, MAX_BODY_CHARS),
    deeplink: FUEL_DEEPLINK,
    source: 'projectStackDay',
  }
}

/**
 * Pure — today's check-in + fuel/stack slots turned into the FE-owned schedule snapshot
 * (N3, bd mezo-h4wp.6.3). Reuses the existing slot times verbatim rather than re-deriving
 * them: check-in times come straight from `data/today/checkins.ts`, fuel/stack times straight
 * from `projectStackDay`'s output. `checkin`/`fuel_slot` are the ONLY categories the backend
 * accepts on this endpoint — everything else is backend-native (AnchorResolver already owns
 * its minute), so this builder never emits any other category by construction.
 *
 * A zone whose every entry is skipped today (rest-day skip, mezo-vx9v) is dropped rather than
 * mapped to a blank-body notification — mirrors `buildDayPlan`'s FuelSlot mapper, which drops
 * the same zones from the "Mai" timeline for the same reason.
 */
export function buildScheduleEntries(
  checkins: Pick<CheckinSlot, 'time'>[],
  slots: StackDaySlot[],
): NotificationScheduleEntry[] {
  const withEntries = slots.filter((s) => s.entries.some((e) => !e.skippedToday))
  return [...checkins.map(checkinEntry), ...withEntries.map(fuelSlotEntry)]
}

/**
 * Fire-and-forget app-open schedule snapshot writer (N3, bd mezo-h4wp.6.3). See AppLayout.tsx
 * for why it is invoked there (the single component that mounts once for the whole app
 * session, already inside the QueryClientProvider tree).
 *
 * Real mode only — mock mode must never reach the network. Waits for `useSleepGoal()`'s
 * `isPending` to clear (ghost wake/bed anchors) AND for `useStack`/`useProtocol` to settle
 * successfully (mezo-b6q0): while those reads are pending — or terminally failed — their
 * realEmpty values ([] stash / ghost occurrences) are not real data, and snapshotting them
 * poisoned every fuel_slot body with projectStackDay's '(törölt Kamra-item)' fallback, which
 * the backend pushes verbatim. `useIntakes`/`useFuelSettings`/`useTrain`/`useRunning` still
 * don't expose a pending flag, so there is a narrow window where slot TIMES (meal windows, the
 * gym-derived pre-workout time) could reflect a ghost if one of those fetches is slower than
 * the gated ones — an accepted, documented gap (the design spec already frames FE-snapshot
 * staleness as "degrades gracefully"): stale times degrade; fallback NAMES were garbage, hence
 * the gate. `useScheduleSnapshotWriter` deliberately does NOT delegate to
 * `useStackDay` (mezo-vx9v Task 9): that hook composes the same sources but doesn't surface
 * `useSleepGoal`'s `isPending`, which this gate needs — routing through it would silently drop
 * the "don't snapshot the pre-resolve ghost" protection this docstring describes.
 *
 * The pre-workout zone's time is derived by `projectStackDay` straight from the day's real
 * training `blocks` (`deriveBlocks`) — the same single derivation `useFuelTimeline`/the Stack
 * page use — so a second, independent derivation of "40 minutes before the first training
 * block" never has the chance to quietly disagree (fix round 1, mezo-h4wp.6.3 review; the
 * rest-day case is now a skip — the zone is absent — rather than a `wake + 60min` fallback).
 *
 * `categories` is DERIVED from the entries actually built — never a separately maintained
 * list — so it is structurally impossible for the payload to name a category some entry
 * doesn't belong to (the caller-misuse path a review flagged for this endpoint).
 *
 * Runs once per mount: the effect has no dependency array (so it re-checks on every render,
 * cheaply, until the data is ready) and a `useRef` flag makes the actual write itself
 * idempotent-once regardless of how many times the effect body runs afterward.
 */
export function useScheduleSnapshotWriter(): void {
  const mock = isMockMode()
  const { stash, pending: stackPending, error: stackError } = useStack()
  const { occurrences, pending: protocolPending, error: protocolError } = useProtocol()
  const intakes = useIntakes(localDateString())
  const { settings } = useFuelSettings()
  const { goal: sleepGoal, isPending: sleepGoalPending } = useSleepGoal()
  const { gymSchedule, sport, sportSlotSkips } = useTrain()
  const { activeRunningBlock } = useRunning()
  const written = useRef(false)

  useEffect(() => {
    // The pantry/protocol gates fix mezo-b6q0: gating on the sleep goal ALONE let an app open
    // where the (heaviest) pantry query was still unresolved snapshot every occurrence as
    // projectStackDay's '(törölt Kamra-item)' fallback — which the backend then pushed verbatim
    // in every fuel_slot notification until a later open happened to win the race. An errored
    // read gates too: its realEmpty value is not real data either. Skipping on error (instead
    // of writing a checkin-only snapshot) is deliberate — the failed-PUT rule below already
    // accepts "this open wrote nothing, the next one retries" as an outcome.
    if (mock || written.current || sleepGoalPending) return
    if (stackPending || stackError || protocolPending || protocolError) return
    written.current = true

    const blocks = deriveBlocks(gymSchedule, sport, activeRunningBlock, sportSlotSkips)
    const slots = projectStackDay({
      occurrences, stash, intakes, wake: sleepGoal.wakeTime, bed: sleepGoal.bedTime,
      mealsPerDay: settings.mealsPerDay, blocks,
    })
    const entries = buildScheduleEntries(initialCheckins, slots)
    if (entries.length === 0) return

    const categories = [...new Set(entries.map((e) => e.category))]
    notificationApi.putSchedule({ categories, entries }).catch(() => {
      // A failed snapshot write must never break app start — the next app open retries.
    })
  })
}
