// ============================================================
// Mezo · habitAnchors — the step-2 anchor chip list for the Fogg branch of the routine wizard
// (mezo-3zue). Two sources: the user's own active habits (a real reference, stored as
// anchorHabitKey so the stack stays machine-readable) and a fixed list of mezo moments (still
// free text — event binding for these tracked separately as mezo-t45n; mezo-3zue.6 bound only
// habit→habit anchors). Pure.
// ============================================================
import type { HabitCatalog } from '@/data/types'

export interface AnchorOption {
  /** Ready-to-render "miután …" clause. */
  label: string
  source: 'SZOKÁS' | 'MEZO'
  /** Set only for SZOKÁS options — the def this recipe stacks onto. */
  habitKey?: string
}

/** Moments the app itself knows about; still free text — event binding tracked as mezo-t45n. */
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
