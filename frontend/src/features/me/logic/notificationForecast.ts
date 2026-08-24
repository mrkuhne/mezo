import type { components } from '@/data/_client/api.gen'
import type { NotificationCategoryKey, NotificationPrefView } from '@/data/types'

type NotificationScheduleEntry = components['schemas']['NotificationScheduleEntry']

type BackendNativeCategory = Exclude<NotificationCategoryKey, 'checkin' | 'fuel_slot'>

/**
 * Today's resolvable anchor times for the FE-forecastable backend-native categories, straight
 * off existing FE hooks (design spec §7: "the FE already knows today's gym time, bed anchor and
 * ritual window") — `null`/`false` means no anchor today (nothing scheduled, the ritual feature
 * is unavailable, or not a medication dose day), never a fabricated minute. `sleep_reaction`/
 * `weight_reaction` are backend-native too but never resolvable here (mezo-gst9): their anchor
 * is the companion message's own generation minute, unknowable client-side ahead of time. Nor
 * are the 6 feed-anchored categories added in F3 (mezo-gzhp.3) resolvable here — see the
 * exhaustive `switch` below, which deliberately returns `null` for all of them (backend events,
 * not client-forecastable); `NotificationsPage` discloses that gap next to their section.
 */
export interface NotificationForecastAnchors {
  /** Wake anchor (briefing daily; weekly on Monday only) — HH:mm. */
  wake: string
  /** Lights-out / bed anchor — HH:mm, or null when unresolved. */
  bedTime: string | null
  /** Today's earliest gym/sport slot — HH:mm, or null when nothing is scheduled today. */
  gymTime: string | null
  /** The napzárás window's opening time — HH:mm, or null when the ritual feature/day has none. */
  ritualOpensAt: string | null
  /** The wind-down (prep) anchor — HH:mm, or null alongside `ritualOpensAt`. */
  ritualPrepStartsAt: string | null
  /** Whether today is an active medication dose day (mirrors the backend's honest cycleDay===0
   *  "no dose logged yet" — that state must never be treated as a dose day). */
  medicationDay: boolean
}

export interface NotificationDenseWindow {
  fromHHmm: string
  toHHmm: string
  count: number
}

export interface NotificationForecast {
  total: number
  /** Count of due items per hour-of-day, index 0..23. */
  perHour: number[]
  denseWindows: NotificationDenseWindow[]
}

// Mirrors AnchorResolver's own hardcoded constants (backend, same package) — stable config-ish
// values, not per-user data, so hardcoding them here for a client-side preview is honest.
const MIDDAY_HHMM = '12:30'
const EVENING_HHMM = '20:30'
const MEMOIR_HHMM = '19:00'
const MEDICATION_HHMM = '08:00' // mirrors mezo.notification.medication-time's default (spec §9)
const ISO_MONDAY = 1
const ISO_SUNDAY = 7
const DENSE_WINDOW_MINUTES = 15
const HOURS_PER_DAY = 24
const MINUTES_PER_DAY = 24 * 60

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function wrapMin(min: number): number {
  return ((min % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
}

function toHHmm(min: number): string {
  const wrapped = wrapMin(min)
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Narrows the wire `category: string` down to the two FE-owned keys — an explicit type
 *  predicate rather than relying on `!==`/`===` control-flow narrowing over a bare `string`. */
function isFeOwnedCategory(category: string): category is 'checkin' | 'fuel_slot' {
  return category === 'checkin' || category === 'fuel_slot'
}

/** The anchor minute (before any lead is subtracted) for one backend-native category on
 *  `weekday` (ISO 1-7) — `null` when nothing is due today. Mirrors AnchorResolver's own rule:
 *  an anchor that isn't available yields no due item, never a defaulted/fabricated minute. */
function backendAnchorMinute(
  category: BackendNativeCategory,
  anchors: NotificationForecastAnchors,
  weekday: number,
): number | null {
  switch (category) {
    case 'briefing':
      return toMin(anchors.wake)
    case 'weekly':
      return weekday === ISO_MONDAY ? toMin(anchors.wake) : null
    case 'memoir':
      return weekday === ISO_SUNDAY ? toMin(MEMOIR_HHMM) : null
    case 'midday':
      return toMin(MIDDAY_HHMM)
    case 'evening':
      return toMin(EVENING_HHMM)
    case 'gym':
      return anchors.gymTime ? toMin(anchors.gymTime) : null
    case 'medication':
      return anchors.medicationDay ? toMin(MEDICATION_HHMM) : null
    case 'ritual':
      return anchors.ritualOpensAt ? toMin(anchors.ritualOpensAt) : null
    case 'lights_out':
      return anchors.bedTime ? toMin(anchors.bedTime) : null
    case 'wind_down':
      return anchors.ritualPrepStartsAt ? toMin(anchors.ritualPrepStartsAt) : null
    case 'sleep_reaction':
    case 'weight_reaction':
      // Event-kind: the anchor is the companion message's OWN generation minute, which the FE
      // cannot know ahead of generation — an honest "no resolvable anchor today", never a
      // fabricated clock time (mirrors gym/medication/ritual's null-when-absent contract).
      return null
    case 'pattern':
    case 'knowledge':
    case 'prediction':
    case 'experiment':
    case 'challenge':
    case 'memory':
      // feed-anchored categories (mezo-gzhp.3): backend events, not FE-forecastable — no preview anchors
      return null
    case 'decision_review':
      // Depends on whether a decision falls due today — a fact the forecast's inputs don't carry.
      // An honest "no resolvable anchor", never a fabricated 09:00 that may not fire (same
      // contract as sleep_reaction/weight_reaction above).
      return null
  }
}

/**
 * Pure — today's push-volume forecast from prefs + the FE-owned schedule + the day's anchors
 * (N3 preview header, bd mezo-h4wp.6.3, design spec §7). No `new Date()` anywhere in here: the
 * caller passes `weekday` (ISO 1-7) and every anchor explicitly, so the result is deterministic
 * and table-testable.
 */
export function forecastToday(
  prefs: NotificationPrefView[],
  scheduleEntries: NotificationScheduleEntry[],
  anchors: NotificationForecastAnchors,
  weekday: number,
): NotificationForecast {
  const enabledLead = new Map<NotificationCategoryKey, number>(
    prefs.filter((p) => p.enabled).map((p) => [p.category, p.leadMinutes]),
  )

  const fireMinutes: number[] = []

  for (const [category, leadMinutes] of enabledLead) {
    if (category === 'checkin' || category === 'fuel_slot') continue
    const anchorMin = backendAnchorMinute(category, anchors, weekday)
    if (anchorMin == null) continue
    fireMinutes.push(anchorMin - leadMinutes)
  }

  for (const entry of scheduleEntries) {
    if (!isFeOwnedCategory(entry.category)) continue
    const leadMinutes = enabledLead.get(entry.category)
    if (leadMinutes === undefined) continue // category not enabled → never due
    if (entry.weekday != null && entry.weekday !== weekday) continue
    fireMinutes.push(toMin(entry.time) - leadMinutes)
  }

  const perHour = Array.from({ length: HOURS_PER_DAY }, () => 0)
  for (const min of fireMinutes) {
    perHour[Math.floor(wrapMin(min) / 60)] += 1
  }

  const sortedWrapped = fireMinutes.map(wrapMin).sort((a, b) => a - b)
  const denseWindows: NotificationDenseWindow[] = []
  let windowStart = 0
  for (let i = 1; i <= sortedWrapped.length; i++) {
    const groupBreaks = i === sortedWrapped.length || sortedWrapped[i] - sortedWrapped[i - 1] > DENSE_WINDOW_MINUTES
    if (!groupBreaks) continue
    const count = i - windowStart
    if (count >= 2) {
      denseWindows.push({ fromHHmm: toHHmm(sortedWrapped[windowStart]), toHHmm: toHHmm(sortedWrapped[i - 1]), count })
    }
    windowStart = i
  }

  return { total: fireMinutes.length, perHour, denseWindows }
}
