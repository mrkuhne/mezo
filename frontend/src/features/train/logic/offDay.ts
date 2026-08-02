// ============================================================
// Mezo · offDay — the shared off-day rule used by MesoEditor and friends
// (mezo-7rdg, spec 2026-08-01-set-budget-unified-editor). Off-days are
// detected by muscle ('' = rest, 'sport' = sport day), NOT by type
// (builder fixtures carry types like 'Volleyball · meccs').
// ============================================================
import type { MesoDay } from '@/data/types'

export function isOffDay(d: Pick<MesoDay, 'muscle'>): boolean {
  return d.muscle === '' || d.muscle === 'sport'
}
