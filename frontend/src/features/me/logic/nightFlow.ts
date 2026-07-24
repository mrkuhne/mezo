/** NightPage state machine vocabulary + the silent 20-minute watchdog (spec D5).
 *  The watchdog compares TIMESTAMPS (not tick counts) so a slept screen catches up
 *  on its next interval tick. No countdown is ever rendered — Walker's rule. */
export type NightPhase = 'idle' | 'waiting' | 'getup'
export type NightTool = 'breathing' | 'bodyscan' | 'walk' | null

export const NIGHT_WATCHDOG_MIN = 20
export const WATCHDOG_TICK_MS = 15_000

export function watchdogDone(startedAtMs: number, nowMs: number): boolean {
  return nowMs - startedAtMs >= NIGHT_WATCHDOG_MIN * 60_000
}
