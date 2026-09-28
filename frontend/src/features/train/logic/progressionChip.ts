// ============================================================
// Mezo · progressionChip (mezo-mgu2r) — the workout card head's one-glance "vs last week"
// label. It replaced the Múlt hét / Ma a cél cells on the card (owner, 2026-09-28): the
// pre-filled set rows already carry today's target, only the direction is news.
// ============================================================
import type { ProgressionSignal } from '@/data/types'

const fmt = (n: number) => n.toLocaleString('hu-HU')

export function progressionChip(p: ProgressionSignal): { text: string; tone: 'up' | 'hold' | 'down' } {
  if (p.deltaKg != null && p.deltaKg !== 0) {
    return p.deltaKg > 0
      ? { text: `↑ +${fmt(p.deltaKg)} kg`, tone: 'up' }
      : { text: `↓ −${fmt(Math.abs(p.deltaKg))} kg`, tone: 'down' }
  }
  if (p.lever === 'rep' && p.deltaReps != null && p.deltaReps > 0) return { text: `↑ +${p.deltaReps} ism.`, tone: 'up' }
  return { text: 'tartjuk', tone: 'hold' }
}

/**
 * The engine's sentence, shown ONLY when it asks for reps past the recipe's range top
 * (mezo-bk7sn: the next real weight would be too big a jump, so reps come first). A "13" in a
 * 10–12 range needs its reason on screen; every other lever is plain from the numbers and chip.
 */
export function overflowWhy(repMax: number, p: ProgressionSignal | null | undefined): string | null {
  if (!p || p.lever !== 'rep' || p.targetReps == null || p.targetReps <= repMax) return null
  return p.rationale || null
}
