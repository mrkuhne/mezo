// ============================================================
// Mezo · offDay — shared off-day predicate for the unified meso day editor
// (mezo-7rdg, spec 2026-08-01-set-budget-unified-editor). Moved verbatim
// from MesoDayTabsEditor.tsx:16-18 — off-days are detected by muscle
// ('' = rest, 'sport' = sport day), NOT by type (builder fixtures carry
// types like 'Volleyball · meccs'). MesoDayTabsEditor keeps its own local
// copy until Task 6 migrates its consumers to MesoEditor.
// ============================================================
import type { MesoDay } from '@/data/types'

export function isOffDay(d: Pick<MesoDay, 'muscle'>): boolean {
  return d.muscle === '' || d.muscle === 'sport'
}
