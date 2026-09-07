// ============================================================
// Mezo · chainStacking (mezo-vxd8) — what each chain row is ACTUALLY anchored to, relative
// to its chain position. Chain position and `anchorHabitKey` are two independent orderings
// (cycles are even storable), and nothing surfaced it before the chain page drew the rope:
// a full rope segment means "anchored to the previous row", a dashed one means the order and
// the anchor disagree. Pure — the page renders what these say, nothing more.
// ============================================================
import type { HabitDefInfo } from '@/data/types'

export interface StackAnchor {
  /** linked = anchored to the PREVIOUS row; foreign = a real link elsewhere; free = prose or none. */
  kind: 'linked' | 'foreign' | 'free'
  label: string
}

/**
 * The badge for `chainDefs[index]` (position order). `allDefs` resolves cross-chain anchors.
 * A dangling key (the anchor def was deleted while this row kept the reference — releaseAnchors
 * should prevent it, but stored data is not a promise) degrades to free text, never throws.
 */
export function stackAnchorOf(chainDefs: HabitDefInfo[], allDefs: HabitDefInfo[], index: number): StackAnchor {
  const d = chainDefs[index]
  const key = d.anchorHabitKey
  if (key == null) {
    return { kind: 'free', label: d.anchorCopy?.trim() ? d.anchorCopy : 'nincs horgony' }
  }
  const anchor = allDefs.find((x) => x.habitKey === key)
  if (anchor == null) {
    return { kind: 'free', label: d.anchorCopy?.trim() ? d.anchorCopy : 'nincs horgony' }
  }
  if (index > 0 && chainDefs[index - 1].habitKey === key) {
    return { kind: 'linked', label: anchor.title }
  }
  const inChain = chainDefs.some((x) => x.habitKey === key)
  return { kind: 'foreign', label: `${anchor.title} · ${inChain ? 'nem az előző' : 'másik lánc'}` }
}

/** The rope segment ABOVE row `index`: null on the first row, 'linked' when the row is anchored
 *  to the previous one, 'broken' (dashed) when order and anchor disagree. */
export function ropeKindOf(chainDefs: HabitDefInfo[], allDefs: HabitDefInfo[], index: number): 'linked' | 'broken' | null {
  if (index === 0) return null
  return stackAnchorOf(chainDefs, allDefs, index).kind === 'linked' ? 'linked' : 'broken'
}
