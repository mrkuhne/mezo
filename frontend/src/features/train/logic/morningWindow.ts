import type { GymScheduleSlot } from '@/data/types'
import { userScopedKey } from '@/shared/lib/userScope'

/** Wake-anchored morning-training window span, in hours (circadian training timing — no relation to the habit engine's tick, which is date-presence). */
export const WINDOW_HOURS = 6
/** Coffee-first start offset (the buildDayPlan "reggeli = wake+45" constant-family). */
export const WINDOW_START_OFFSET_MIN = 60
export const snoozeKey = () => userScopedKey('morning-training-snooze')

export interface MorningWindow {
  start: string
  end: string
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHHmm = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** The wake-anchored morning training window: [wake + 60', wake + 6h] (spec D1). */
export function morningWindow(wakeTime: string): MorningWindow {
  const wake = toMin(wakeTime)
  return { start: toHHmm(wake + WINDOW_START_OFFSET_MIN), end: toHHmm(wake + WINDOW_HOURS * 60) }
}

/** Slots AFTER the window end — an earlier-than-start slot is still morning training (spec D3). */
export function offendingSlots(slots: GymScheduleSlot[], window: MorningWindow): GymScheduleSlot[] {
  return slots.filter((s) => s.time > window.end)
}

/** Full replacement list for the one-tap PUT: offenders land on the window start, rest pass. */
export function rescheduledSlots(slots: GymScheduleSlot[], window: MorningWindow): GymScheduleSlot[] {
  return slots.map((s) => (s.time > window.end ? { ...s, time: window.start } : s))
}

/** Content key: the snooze holds this exact state — any schedule/wake change re-arms the card. */
export function snoozeHash(wakeTime: string, offending: GymScheduleSlot[]): string {
  return `${wakeTime}|${offending.map((s) => `${s.dayOfWeek}@${s.time}`).join(',')}`
}

export function isSnoozed(hash: string): boolean {
  try {
    return localStorage.getItem(snoozeKey()) === hash
  } catch {
    return false
  }
}

export function snooze(hash: string): void {
  try {
    localStorage.setItem(snoozeKey(), hash)
  } catch {
    /* storage unavailable — best effort */
  }
}
