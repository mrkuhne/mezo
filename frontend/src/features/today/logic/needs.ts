import { clampPct } from '@/shared/lib/pct'
import type { ClayIconName } from '@/shared/ui/clay'

/**
 * "Életjel-ringek" (Sims-style needs) decay/refill engine — pure, no I/O.
 * Spec: .superpowers/sdd/2026-08-17-needs-rings/. Six rings decay continuously
 * (a slower rate while asleep) and refill from logged events (meals, water,
 * activity, check-ins, sleep). Everything below is deterministic given
 * `(now, inputs)` — the same instant always reproduces the same NeedState[].
 *
 * Simulation model: each ring's value is walked chronologically from the wake
 * boundary 24h before `now`'s current wake period (baseline 0 there — the
 * carry factor / decay make deeper history negligible) up to `now`, crossing
 * wake/bed boundaries (which switch the decay rate, and for 'carry' rings
 * multiply the value down) and logged events (which add to or set the value),
 * clamping to [0, 100] after every step.
 */

export type NeedKey = 'energia' | 'hidratacio' | 'pihenes' | 'mozgas' | 'lelek' | 'rend'
export type NeedBand = 'green' | 'yellow' | 'red' | 'critical'

export interface NeedEvent {
  at: Date
  kind: 'add' | 'set' // additive refill vs set-to-value (workout=100, sleep-set)
  amount: number // 'add': +pct; 'set': absolute pct
  label: string // HU, for the sheet timeline ("+250 ml", "Ebéd", "Edzés")
}

export interface NeedsInputs {
  wakeTime: string // 'HH:mm' from SleepGoal.wakeTime
  bedTime: string // 'HH:mm' from SleepGoal.bedTime
  events: Record<NeedKey, NeedEvent[]> // yesterday-wake → now, any order (engine sorts)
}

export interface NeedState {
  key: NeedKey
  emoji: string // 🍽️ 💧 😴 💪 💗 ⚡
  label: string // Energia · Hidratáció · Pihenés · Mozgás · Lélek · Rend
  color: string // CSS var name
  pct: number // 0..100, rounded to integer
  ratePerHour: number // current decay rate, positive number (display as −N%/óra)
  zeroAt: Date | null // forecast within next 24h at current rates, else null
  band: NeedBand
  lastFill: { at: Date; label: string } | null // latest event ≤ now
  todayFills: { at: Date; label: string }[] // today's events (at ≥ today wake, ≤ now)
}

type WakeTransform = 'none' | 'carry' | 'sleepSet'

interface RingTuning {
  awakeRate: number // %/h while awake
  nightRate: number // %/h while asleep (0 = paused)
  wakeTransform: WakeTransform // applied at the wake boundary
}

export const NEEDS_TUNING: {
  rings: Record<NeedKey, RingTuning>
  carryFactor: number
  bands: { green: number; red: number; critical: number }
  refill: {
    mainMeal: number
    snack: number
    waterGlassMl: number
    waterGlass: number
    activity: number
    checkin: number
    intention: number
    reflection: number
    habitTick: number
  }
} = {
  rings: {
    energia: { awakeRate: 6, nightRate: 2, wakeTransform: 'none' },
    hidratacio: { awakeRate: 6, nightRate: 2, wakeTransform: 'none' },
    pihenes: { awakeRate: 5, nightRate: 0, wakeTransform: 'sleepSet' },
    mozgas: { awakeRate: 2, nightRate: 2, wakeTransform: 'none' },
    lelek: { awakeRate: 5, nightRate: 0, wakeTransform: 'carry' },
    rend: { awakeRate: 4, nightRate: 0, wakeTransform: 'carry' },
  },
  carryFactor: 0.4,
  bands: { green: 60, red: 30, critical: 15 },
  refill: {
    mainMeal: 40,
    snack: 15,
    waterGlassMl: 250,
    waterGlass: 12,
    activity: 25,
    checkin: 20,
    intention: 15,
    reflection: 25,
    habitTick: 12,
  },
} as const

export const NEED_META: Record<NeedKey, { emoji: string; label: string; color: string }> = {
  energia: { emoji: '🍽️', label: 'Energia', color: 'var(--dv-sage)' },
  hidratacio: { emoji: '💧', label: 'Hidratáció', color: 'var(--dv-sky)' },
  pihenes: { emoji: '😴', label: 'Pihenés', color: 'var(--dv-lav)' },
  mozgas: { emoji: '💪', label: 'Mozgás', color: 'var(--dv-coral)' },
  lelek: { emoji: '💗', label: 'Lélek', color: 'var(--dv-rose)' },
  rend: { emoji: '⚡', label: 'Rend', color: 'var(--accent-base)' },
}

/** mezo-z4h4: EGY forrás a NeedKey → domain clay ikon leképezésnek — az Életjel oldal
 *  tile-jai (`VITAL_TILE`, EletjelPage.tsx) és a küszöb-nudge kártyák (`needsNudges.ts`)
 *  ugyanezt olvassák, hogy sose csússzanak szét. */
export const NEED_ICON: Record<NeedKey, ClayIconName> = {
  energia: 'i-fuel',
  hidratacio: 'i-viz',
  pihenes: 'i-alvas',
  mozgas: 'i-edzes',
  lelek: 'i-emberek',
  rend: 'i-rend',
}

const NEED_ORDER: NeedKey[] = ['energia', 'hidratacio', 'pihenes', 'mozgas', 'lelek', 'rend']

/** The Életjel SEGMENTED ring: six equal arcs, each filled to its need's level.
 *  Shared by the Nap hub's Életjel tile and the /nap/eletjel hero (mezo-d20.2.6). */
export function needRingGradient(states: { key: NeedKey; pct: number }[]): string {
  const stops: string[] = []
  const seg = 100 / 6
  states.forEach((s, i) => {
    const from = i * seg
    const fillTo = from + (seg * Math.max(0, Math.min(100, s.pct))) / 100
    const to = (i + 1) * seg
    stops.push(`${NEED_META[s.key].color} ${from}% ${fillTo}%`)
    if (fillTo < to) stops.push(`rgba(43,33,24,0.08) ${fillTo}% ${to}%`)
  })
  return `conic-gradient(${stops.join(', ')})`
}

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MINUTES_PER_DAY = 24 * 60

/** Sim baseline is 0 at the wake boundary this many hours before `now`'s current
 * wake period — deep history is negligible under the carry factor / decay anyway. */
const SIM_LOOKBACK_HOURS = 24
/** `zeroAt` only forecasts within this horizon; beyond it the sheet shows null (no CTA math). */
const ZERO_AT_HORIZON_HOURS = 24

export function bandOf(pct: number): NeedBand {
  const { bands } = NEEDS_TUNING
  if (pct >= bands.green) return 'green'
  if (pct >= bands.red) return 'yellow'
  if (pct >= bands.critical) return 'red'
  return 'critical'
}

// --- time-of-day helpers ----------------------------------------------------

const toMinuteOfDay = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** `base`'s calendar date at the given HH:mm wall-clock time. */
const atTime = (base: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(':').map(Number)
  const out = new Date(base)
  out.setHours(h, m, 0, 0)
  return out
}

const addHours = (at: Date, hours: number): Date => new Date(at.getTime() + hours * MS_PER_HOUR)

/** True while `[wakeTime, bedTime)` contains `at`'s wall-clock time — wrap-aware
 * (an overnight-awake window, bedTime < wakeTime, wraps past midnight). */
const isAwakeAt = (at: Date, wakeTime: string, bedTime: string): boolean => {
  const n = at.getHours() * 60 + at.getMinutes()
  const wake = toMinuteOfDay(wakeTime)
  const bed = toMinuteOfDay(bedTime)
  return wake <= bed ? n >= wake && n < bed : n >= wake || n < bed
}

/** The next wake/bed crossing strictly after `from` — wrap-aware: if the target
 * time-of-day is at or before `from`'s time-of-day, it lands the next calendar day. */
const nextCrossing = (from: Date, wakeTime: string, bedTime: string, awake: boolean): Date => {
  const target = toMinuteOfDay(awake ? bedTime : wakeTime)
  const fromMin = from.getHours() * 60 + from.getMinutes()
  let deltaMin = target - fromMin
  if (deltaMin <= 0) deltaMin += MINUTES_PER_DAY
  return new Date(from.getTime() + deltaMin * MS_PER_MINUTE)
}

/** The most recent wake boundary at or before `now` — the start of the awake
 * period `now` currently belongs to. */
const currentWakeBoundary = (now: Date, wakeTime: string): Date => {
  const todayWake = atTime(now, wakeTime)
  if (now.getTime() < todayWake.getTime()) {
    const yesterdayWake = new Date(todayWake)
    yesterdayWake.setDate(yesterdayWake.getDate() - 1)
    return yesterdayWake
  }
  return todayWake
}

// --- simulation --------------------------------------------------------------

type Point =
  | { at: Date; sortRank: 0; kind: 'wake' | 'bed' }
  | { at: Date; sortRank: 1; kind: 'event'; event: NeedEvent }

/** Boundary crossings (wake/bed) strictly between `from` (a wake instant) and
 * `until`, inclusive of a crossing landing exactly on `until`. */
function boundariesUpTo(from: Date, until: Date, wakeTime: string, bedTime: string): Point[] {
  const points: Point[] = []
  let cursor = from
  let awake = true // the segment right after a wake boundary is always awake
  for (;;) {
    const next = nextCrossing(cursor, wakeTime, bedTime, awake)
    if (next.getTime() > until.getTime()) break
    points.push({ at: next, sortRank: 0, kind: awake ? 'bed' : 'wake' })
    cursor = next
    awake = !awake
  }
  return points
}

/** Simulate a single ring's raw (unrounded, clamped) value at `now`. */
function simulateRing(
  tuning: RingTuning,
  events: NeedEvent[],
  simStart: Date,
  now: Date,
  wakeTime: string,
  bedTime: string,
): number {
  const boundaries = boundariesUpTo(simStart, now, wakeTime, bedTime)
  const eventPoints: Point[] = events
    .filter((e) => e.at.getTime() <= now.getTime())
    .map((event) => ({ at: event.at, sortRank: 1, kind: 'event', event }))

  const points = [...boundaries, ...eventPoints].sort((a, b) => {
    const diff = a.at.getTime() - b.at.getTime()
    return diff !== 0 ? diff : a.sortRank - b.sortRank // boundary transform before a same-instant event
  })

  let value = 0
  let cursor = simStart
  let awake = true // segment right after simStart (a wake instant) is awake

  const decayTo = (at: Date) => {
    const hours = (at.getTime() - cursor.getTime()) / MS_PER_HOUR
    const rate = awake ? tuning.awakeRate : tuning.nightRate
    value = clampPct(value - rate * hours)
    cursor = at
  }

  for (const point of points) {
    decayTo(point.at)
    if (point.kind === 'wake') {
      if (tuning.wakeTransform === 'carry') value = clampPct(value * NEEDS_TUNING.carryFactor)
      awake = true
    } else if (point.kind === 'bed') {
      awake = false
    } else if (point.kind === 'event') {
      value = clampPct(point.event.kind === 'set' ? point.event.amount : value + point.event.amount)
    }
  }
  decayTo(now)

  return value
}

/** Project a ring's value forward from `now` with no future events, up to
 * +24h, to find the instant it would hit 0 at current rates. */
function forecastZeroAt(
  tuning: RingTuning,
  value: number,
  now: Date,
  wakeTime: string,
  bedTime: string,
): Date | null {
  if (value <= 0) return null

  const limit = addHours(now, ZERO_AT_HORIZON_HOURS)
  let v = value
  let cursor = now
  let awake = isAwakeAt(now, wakeTime, bedTime)

  while (cursor.getTime() < limit.getTime()) {
    const rate = awake ? tuning.awakeRate : tuning.nightRate
    const boundary = nextCrossing(cursor, wakeTime, bedTime, awake)
    const segmentEnd = boundary.getTime() < limit.getTime() ? boundary : limit
    const hoursAvailable = (segmentEnd.getTime() - cursor.getTime()) / MS_PER_HOUR

    if (rate > 0) {
      const hoursToZero = v / rate
      if (hoursToZero <= hoursAvailable) return addHours(cursor, hoursToZero)
      v -= rate * hoursAvailable
    }

    cursor = segmentEnd
    if (segmentEnd.getTime() === boundary.getTime() && segmentEnd.getTime() < limit.getTime()) {
      // crossing into awake applies the carry transform; crossing into night never does
      if (!awake && tuning.wakeTransform === 'carry') v *= NEEDS_TUNING.carryFactor
      awake = !awake
    }
  }
  return null
}

export function needsAt(now: Date, inputs: NeedsInputs): NeedState[] {
  const { wakeTime, bedTime, events } = inputs
  const todayWake = currentWakeBoundary(now, wakeTime)
  const simStart = addHours(todayWake, -SIM_LOOKBACK_HOURS)

  return NEED_ORDER.map((key) => {
    const tuning = NEEDS_TUNING.rings[key]
    const meta = NEED_META[key]
    const ringEvents = events[key]

    const rawValue = simulateRing(tuning, ringEvents, simStart, now, wakeTime, bedTime)
    const pct = Math.round(rawValue)

    const pastEvents = ringEvents
      .filter((e) => e.at.getTime() <= now.getTime())
      .sort((a, b) => a.at.getTime() - b.at.getTime())

    const lastEvent = pastEvents.at(-1)
    const lastFill = lastEvent ? { at: lastEvent.at, label: lastEvent.label } : null

    const todayFills = pastEvents
      .filter((e) => e.at.getTime() >= todayWake.getTime())
      .map((e) => ({ at: e.at, label: e.label }))

    return {
      key,
      emoji: meta.emoji,
      label: meta.label,
      color: meta.color,
      pct,
      ratePerHour: isAwakeAt(now, wakeTime, bedTime) ? tuning.awakeRate : tuning.nightRate,
      zeroAt: forecastZeroAt(tuning, rawValue, now, wakeTime, bedTime),
      band: bandOf(pct),
      lastFill,
      todayFills,
    }
  })
}
