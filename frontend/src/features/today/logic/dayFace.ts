// ============================================================
// Mezo · dayFace — the three sleep-anchored daypart windows behind Today's
// face navigator (mezo-ly8c). Derived from the SAME wake/bed anchor that
// drives `windDown.ts` and the Napzárás window, so the app has one clock and
// no drift. `MORNING_LEAD_MIN` is deliberately the exact minute at which
// `windDownPhase`'s `night` ends, so the day closes a circle:
//   night → reggel → nap → este (dim → winddown) → night
// All math is minute-of-day and wrap-aware (a past-midnight bed works).
// ============================================================
import { MORNING_LEAD_MIN, type AnchorTimes } from '@/features/today/logic/windDown'

export type DayFace = 'reggel' | 'nap' | 'este'
export const DAY_FACES: readonly DayFace[] = ['reggel', 'nap', 'este'] as const
export const FACE_LABEL: Record<DayFace, string> = { reggel: 'Reggel', nap: 'Nap', este: 'Este' }
export const FACE_EMOJI: Record<DayFace, string> = { reggel: '🌅', nap: '☀️', este: '🌙' }

/** How long the morning face runs past wake-up. */
export const MORNING_SPAN_MIN = 300
/** How long before bed the evening face opens. */
export const EVENING_LEAD_MIN = 240

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const wrap = (m: number) => ((m % 1440) + 1440) % 1440
/** Half-open [start, end) containment on the circular 24h clock. */
const inWindow = (n: number, start: number, end: number) =>
  start <= end ? n >= start && n < end : n >= start || n < end

export function faceWindows(goal: AnchorTimes): Record<DayFace, { start: number; end: number }> {
  const morningStart = wrap(toMin(goal.wakeTime) - MORNING_LEAD_MIN)
  const morningEnd = wrap(toMin(goal.wakeTime) + MORNING_SPAN_MIN)
  const eveningStart = wrap(toMin(goal.bedTime) - EVENING_LEAD_MIN)
  // Degenerate-anchor guard: with a very short waking day the evening window can open
  // before the morning one closes. The morning face keeps its full span and the day
  // face collapses to zero length rather than inverting — `dayFace` then simply never
  // returns 'nap', but every minute still resolves to a face.
  const napEnd = inWindow(eveningStart, morningStart, morningEnd) ? morningEnd : eveningStart
  return {
    reggel: { start: morningStart, end: morningEnd },
    nap: { start: morningEnd, end: napEnd },
    este: { start: napEnd, end: morningStart },
  }
}

/** The face a given minute-of-day belongs to. Evening is the fallback: it owns the
 *  night, and it is the only window guaranteed non-empty for any anchor. */
function faceForMinute(n: number, goal: AnchorTimes): DayFace {
  const w = faceWindows(goal)
  if (inWindow(n, w.reggel.start, w.reggel.end)) return 'reggel'
  if (w.nap.start !== w.nap.end && inWindow(n, w.nap.start, w.nap.end)) return 'nap'
  return 'este'
}

export function dayFace(now: Date, goal: AnchorTimes): DayFace {
  return faceForMinute(now.getHours() * 60 + now.getMinutes(), goal)
}

/** Which face an item anchored to `hhmm` belongs to. */
export function faceOf(hhmm: string, goal: AnchorTimes): DayFace {
  return faceForMinute(toMin(hhmm), goal)
}
