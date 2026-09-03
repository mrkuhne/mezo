// ============================================================
// Mezo · habitAnchors — the step-2 anchor chip list for the Fogg branch of the routine wizard
// (mezo-3zue). Two sources: the user's own active habits (a real reference, stored as
// anchorHabitKey so the stack stays machine-readable) and a fixed list of mezo moments (free
// text in v1 — event binding is mezo-3zue.6). Pure.
// ============================================================
import type { HabitCatalog } from '@/data/types'

export interface AnchorOption {
  /** Ready-to-render "miután …" clause. */
  label: string
  source: 'SZOKÁS' | 'MEZO'
  /** Set only for SZOKÁS options — the def this recipe stacks onto. */
  habitKey?: string
}

/** Moments the app itself knows about; free text in v1, event-bound in mezo-3zue.6. */
export const MEZO_EVENT_ANCHORS: AnchorOption[] = [
  { label: 'megmértem magam', source: 'MEZO' },
  { label: 'logoltam a reggelit', source: 'MEZO' },
  { label: 'befejeztem az edzést', source: 'MEZO' },
  { label: 'lezártam a napot', source: 'MEZO' },
]

export function habitAnchorOptions(catalog: HabitCatalog, excludeDefId?: string): AnchorOption[] {
  const own = catalog.chains
    .flatMap((chain) => chain.defs)
    .filter((d) => d.isActive && d.id !== excludeDefId)
    .map((d) => ({ label: `kész a ${d.title}`, source: 'SZOKÁS' as const, habitKey: d.habitKey }))
  return [...own, ...MEZO_EVENT_ANCHORS]
}
