import type { CheckinSlot } from '@/data/types'

/** Napív geometry+data (spec §3.4). The day window is 04:00–24:00 mapped to t∈[0,1]
    along the quadratic Bézier M 22 100 Q 182 -28 342 100 (viewBox 364×112). */
export type ArcPoint = {
  t: number
  kind: 'checkin-done' | 'checkin-now' | 'checkin-pending' | 'workout' | 'sleep'
  label: string
}

const DAY_START = 4 * 60
const DAY_END = 24 * 60
const SLEEP_LABEL = '23:00'

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
function tOf(hhmm: string): number {
  const clamped = Math.min(Math.max(minutesOf(hhmm), DAY_START), DAY_END)
  return (clamped - DAY_START) / (DAY_END - DAY_START)
}

export function buildArcPoints(input: { checkins: CheckinSlot[]; workoutTime: string | null }): ArcPoint[] {
  const pts: ArcPoint[] = input.checkins.map(c => ({
    t: tOf(c.time),
    kind: c.state === 'done' ? 'checkin-done' : c.state === 'now' ? 'checkin-now' : 'checkin-pending',
    label: c.time,
  }))
  if (input.workoutTime) pts.push({ t: tOf(input.workoutTime), kind: 'workout', label: input.workoutTime })
  pts.push({ t: tOf(SLEEP_LABEL), kind: 'sleep', label: SLEEP_LABEL })
  return pts.sort((a, b) => a.t - b.t)
}

export function arcProgress(now: Date): number {
  const mins = now.getHours() * 60 + now.getMinutes()
  if (mins < DAY_START) return 1
  return Math.min((mins - DAY_START) / (DAY_END - DAY_START), 1)
}

/** Quadratic Bézier point at t for P0(22,100) C(182,-28) P2(342,100). */
export function pointXY(t: number): { x: number; y: number } {
  const u = 1 - t
  return {
    x: Math.round((u * u * 22 + 2 * u * t * 182 + t * t * 342) * 100) / 100,
    y: Math.round((u * u * 100 + 2 * u * t * -28 + t * t * 100) * 100) / 100,
  }
}
