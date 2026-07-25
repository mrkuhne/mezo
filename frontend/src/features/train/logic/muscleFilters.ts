// Two-level muscle filter (mezo-wu1s) shared by ExercisePickerSheet and ExercisesPage.
// Level 1 (top row): 'all' + 'plyo' (a TYPE filter) + the 6 regions. Picking a region
// filters to all its tokens and reveals a level-2 sub-row of that region's muscles for
// narrowing. 21 flat chips was too many once the taxonomy went head-specific.
import { muscleRegion, REGION_MUSCLES, REGION_ORDER, REGION_LABELS, type RegionKey } from '@/features/train/logic/muscleColors'

export type TopFilter = 'all' | 'plyo' | RegionKey

/** Level-1 chips, in order: Összes · Plyo · <6 regions>. */
export const TOP_FILTERS: TopFilter[] = ['all', 'plyo', ...REGION_ORDER]

/** Level-1 chip labels ('all'/'plyo' + region labels). */
export const TOP_FILTER_LABELS: Record<string, string> = {
  all: 'Összes', plyo: 'Plyo', ...REGION_LABELS,
}

const REGION_KEYS = new Set<string>(REGION_ORDER)
export const isRegionFilter = (f: string): f is RegionKey => REGION_KEYS.has(f)

/**
 * Level-2 sub-chips for a top filter: a region's muscle tokens, or [] when the top filter
 * is 'all'/'plyo' or a single-muscle region (no point narrowing one muscle).
 */
export function subMuscles(top: TopFilter): string[] {
  if (!isRegionFilter(top)) return []
  const muscles = REGION_MUSCLES.find((g) => g.region === top)?.muscles ?? []
  return muscles.length > 1 ? muscles : []
}

/**
 * Two-level predicate: `top` is 'all' | 'plyo' | a region key; `sub` is a specific muscle
 * token within the region (narrowing) or null for the whole region.
 */
export function matchesMuscleFilter(muscle: string, type: string, top: TopFilter, sub: string | null): boolean {
  if (top === 'all') return true
  if (top === 'plyo') return type === 'plyo'
  if (sub) return muscle === sub
  return muscleRegion(muscle) === top
}
