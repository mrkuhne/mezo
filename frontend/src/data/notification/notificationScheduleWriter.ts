import { useEffect, useRef } from 'react'
import { isMockMode } from '@/data/_client/mode'
import { notificationApi } from '@/data/notification/notificationApi'
import { initialCheckins } from '@/data/today/checkins'
import { useStack, useProtocol } from '@/data/fuel/stackHooks'
import { useSleepGoal } from '@/data/me/sleepHooks'
import { useTrain } from '@/data/train/trainHooks'
import { useRunning } from '@/data/train/runningHooks'
import { buildProtocol, deriveProtocolAnchors } from '@/features/fuel/logic/buildProtocol'
import type { components } from '@/data/_client/api.gen'
import type { CheckinSlot, ProtocolSlotData } from '@/data/types'

type NotificationScheduleEntry = components['schemas']['NotificationScheduleEntry']

const MAX_TITLE_CHARS = 120
const MAX_BODY_CHARS = 300
const CHECKIN_BODY = 'Hogy vagy most? Energia, stressz, test, fej — 20 másodperc.'
const CHECKIN_DEEPLINK = '/today' // the real check-in sheet mounts on /today (CheckInSheet)
const FUEL_DEEPLINK = '/fuel/stack'

/** Human label per `buildProtocol` slot window — mirrors the mockup's "Stack · reggeli slot"
 *  style titles without re-deriving the slot's meaning; falls back to the raw window key for
 *  any future window buildProtocol.ts might add, so a new slot never renders as `undefined`. */
const FUEL_WINDOW_LABEL: Record<string, string> = {
  wake: 'reggeli',
  'pre-snack': 'edzés előtti snack',
  'T-40min': 'edzés előtti',
  'ebéd': 'ebédi',
  'T-2h sleep': 'esti',
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
    deeplink: CHECKIN_DEEPLINK,
    source: 'checkinSlots',
  }
}

function fuelSlotEntry(slot: ProtocolSlotData): NotificationScheduleEntry {
  const label = FUEL_WINDOW_LABEL[slot.window] ?? slot.window
  const body = slot.items.length
    ? slot.items.map((item) => (item.dose ? `${item.name} ${item.dose}` : item.name)).join(' + ') + '.'
    : 'Stack-tétel ebben a slotban.'
  return {
    weekday: null, // fuel/stack slots recur every day
    time: slot.time,
    category: 'fuel_slot',
    title: truncate(`Stack · ${label} slot`, MAX_TITLE_CHARS),
    body: truncate(body, MAX_BODY_CHARS),
    deeplink: FUEL_DEEPLINK,
    source: 'buildProtocol',
  }
}

/**
 * Pure — today's check-in + fuel/stack slots turned into the FE-owned schedule snapshot
 * (N3, bd mezo-h4wp.6.3). Reuses the existing slot times verbatim rather than re-deriving
 * them: check-in times come straight from `data/today/checkins.ts`, fuel/stack times straight
 * from `buildProtocol`'s output. `checkin`/`fuel_slot` are the ONLY categories the backend
 * accepts on this endpoint — everything else is backend-native (AnchorResolver already owns
 * its minute), so this builder never emits any other category by construction.
 */
export function buildScheduleEntries(
  checkins: Pick<CheckinSlot, 'time'>[],
  protocolSlots: ProtocolSlotData[],
): NotificationScheduleEntry[] {
  return [...checkins.map(checkinEntry), ...protocolSlots.map(fuelSlotEntry)]
}

/**
 * Fire-and-forget app-open schedule snapshot writer (N3, bd mezo-h4wp.6.3). See AppLayout.tsx
 * for why it is invoked there (the single component that mounts once for the whole app
 * session, already inside the QueryClientProvider tree).
 *
 * Real mode only — mock mode must never reach the network. Waits for `useSleepGoal()`'s
 * `isPending` to clear before writing: firing on the very first render would snapshot the
 * pre-resolve ghost wake/bed anchors (and possibly an empty stash) as if they were real,
 * which is a worse snapshot than waiting a beat. `useStack`/`useProtocol`/`useTrain`/
 * `useRunning` don't expose their own pending flag, so there is a narrow window where the
 * fuel/stack slots (including the gym-derived pre-workout time) could still reflect a ghost
 * if one of those fetches is slower than the sleep-goal one — an accepted, documented gap
 * (the design spec already frames FE-snapshot staleness as "degrades gracefully"), not a
 * silent one.
 *
 * The `preWorkout` anchor is derived via the CANONICAL `deriveProtocolAnchors` (same function
 * `useFuelTimeline`/the settings preview use) — this is deliberate: a second, independent
 * derivation of "40 minutes before the first training block" is exactly the drift this design
 * was shaped to avoid (fix round 1, mezo-h4wp.6.3 review). Without it, every persisted
 * `fuel_slot` row would silently fall back to `wake + 60min` on every training day, hours off
 * the real pre-workout time.
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
  const { stash } = useStack()
  const { selectedIds } = useProtocol()
  const { goal: sleepGoal, isPending: sleepGoalPending } = useSleepGoal()
  const { gymSchedule, sport } = useTrain()
  const { activeRunningBlock } = useRunning()
  const written = useRef(false)

  useEffect(() => {
    if (mock || written.current || sleepGoalPending) return
    written.current = true

    const selection = selectedIds ?? stash.filter((s) => s.type !== 'medication').map((s) => s.id)
    const anchors = deriveProtocolAnchors(gymSchedule, sport, activeRunningBlock, sleepGoal.wakeTime, sleepGoal.bedTime)
    const protocolSlots = buildProtocol(selection, stash, anchors).slots
    const entries = buildScheduleEntries(initialCheckins, protocolSlots)
    if (entries.length === 0) return

    const categories = [...new Set(entries.map((e) => e.category))]
    notificationApi.putSchedule({ categories, entries }).catch(() => {
      // A failed snapshot write must never break app start — the next app open retries.
    })
  })
}
