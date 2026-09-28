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
