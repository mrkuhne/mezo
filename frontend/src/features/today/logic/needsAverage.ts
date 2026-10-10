import type { NeedState } from '@/features/today/logic/needs'

/** The one number of the six életjel: the rounded mean of their levels; `null` while there is nothing to average
 *  (pending or empty), so a caller never shows a fabricated 0. */
export function needsAverage(states: readonly Pick<NeedState, 'pct'>[]): number | null {
  if (states.length === 0) return null
  return Math.round(states.reduce((sum, n) => sum + n.pct, 0) / states.length)
}

const NEED_WORD: Record<NeedState['key'], string> = {
  energia: 'az étel', hidratacio: 'a víz', pihenes: 'az alvás', mozgas: 'a mozgás', lelek: 'a kapcsolat', rend: 'a rend',
}

/** „a mozgás kér figyelmet" — only when EXACTLY one need sits in the red / critical band; otherwise `null`. */
export function needsAttentionLine(states: readonly Pick<NeedState, 'key' | 'band'>[]): string | null {
  const low = states.filter((s) => s.band === 'red' || s.band === 'critical')
  return low.length === 1 ? `${NEED_WORD[low[0].key]} kér figyelmet` : null
}
