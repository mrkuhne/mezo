import type { CSSProperties } from 'react'

/** The csapatfal entrance stagger: a `.rise` child of an `EntranceGroup` waits `--d` before it
 *  rises (the DimensionsPage / KnowledgeListPage idiom; reduced motion settles it globally). */
export function riseStyle(ms: number): CSSProperties {
  return { '--d': `${ms}ms` } as CSSProperties
}
