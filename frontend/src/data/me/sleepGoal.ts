import type { SleepGoal, SleepGoalInput } from '@/data/types'

const pad = (n: number) => String(n).padStart(2, '0')
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const toHHmm = (min: number) => `${pad(Math.floor(((min % 1440) + 1440) % 1440 / 60))}:${pad(((min % 1440) + 1440) % 1440 % 60)}`

/** WAKE fixed -> bed = wake − target; BED fixed -> wake = bed + target (mod 24h). Mirrors SleepAnchorResolver.derive. */
export function deriveSleepTimes(anchor: 'WAKE' | 'BED', anchorTime: string, targetMinutes: number): { wakeTime: string; bedTime: string } {
  return anchor === 'WAKE'
    ? { wakeTime: anchorTime, bedTime: toHHmm(toMin(anchorTime) - targetMinutes) }
    : { wakeTime: toHHmm(toMin(anchorTime) + targetMinutes), bedTime: anchorTime }
}

export function composeSleepGoal(input: SleepGoalInput): SleepGoal {
  return { ...input, ...deriveSleepTimes(input.anchor, input.anchorTime, input.targetMinutes) }
}

/** The backend's config-default ghost (spec §3) — the honest real-mode empty value. */
export const SLEEP_GOAL_GHOST: SleepGoal = composeSleepGoal({
  targetMinutes: 480, anchor: 'WAKE', anchorTime: '06:00', regularityBandMin: 15,
})

// Demo seed tuned to the mock sleepLog cluster (bed ~23:15 / wake ~06:45) for a credible regularity score.
export const mockSleepGoal: SleepGoal = composeSleepGoal({
  targetMinutes: 450, anchor: 'WAKE', anchorTime: '06:45', regularityBandMin: 15,
})
