/** Circadian daypart bands (Napív spec §3.4): reggel 04:00–11:59 · délután 12:00–17:59 · este 18:00–03:59. */
export type Daypart = 'reggel' | 'delutan' | 'este'

export function daypartForHour(hour: number): Daypart {
  if (hour >= 4 && hour < 12) return 'reggel'
  if (hour >= 12 && hour < 18) return 'delutan'
  return 'este'
}

export function daypartNow(now: Date = new Date()): Daypart {
  return daypartForHour(now.getHours())
}
