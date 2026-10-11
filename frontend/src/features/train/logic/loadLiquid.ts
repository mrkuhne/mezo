// ============================================================
// Mezo · loadLiquid — how the Terhelés pages pour their numbers into vessels (Folyadék F3,
// mezo-n4wf5.3). Presentation only: every function reads what loadWeek.ts / weekZone.ts /
// sportMuscleLoad.ts already computed and turns it into a level, never a new verdict.
// ============================================================
import type { BodyHeat } from '@/features/train/components/BodyMap'
import type { BodyLiqEntry } from '@/features/train/components/folyadek'
import { REGION_LABELS, REGION_ORDER, muscleRegion, regionColor, type RegionKey } from '@/features/train/logic/muscleColors'
import type { LoadLevel, SportLoadResult } from '@/features/train/logic/sportMuscleLoad'

/**
 * How full a muscle stands on the body for each heat level the live logic hands out
 * (mapWeekHeat / mapHeat, loadWeek.ts). The steps are the old BodyMap opacity ladder read
 * as a level: nothing yet → a first third → about half (today's plan will cross the floor)
 * → well in → full.
 */
export const HEAT_FILL: Record<BodyHeat['level'], number> = {
  none: 0, below: 0.34, entering: 0.5, in: 0.72, over: 1,
}

/** The word of a heat level in the map's key. 'entering' is still logged work below the
 *  floor, so it reads as „elkezdted" — the map promises logged work only. */
export const HEAT_WORD: Record<BodyHeat['level'], string> = {
  none: 'még vár', below: 'elkezdted', entering: 'elkezdted', in: 'jó úton', over: 'megvan',
}

/**
 * Heat rows → the body vessel's entries.
 *   · `done`    — the whole plan stands in pale liquid, the logged work rises in it, deep;
 *   · `planned` — only the pale liquid: the more the week asks of a muscle, the fuller.
 */
export function heatEntries(heat: BodyHeat[], mode: 'done' | 'planned'): BodyLiqEntry[] {
  return heat.map((h) => (mode === 'done'
    ? { muscle: h.token, done: HEAT_FILL[h.level], planned: 1 }
    : { muscle: h.token, done: 0, planned: HEAT_FILL[h.level] }))
}

/** done / planned as a level, never fabricated: no plan and no work is an empty vessel; any
 *  real work keeps a visible sliver. */
export function sharePct(row: { doneSets: number; plannedSets: number }): number {
  if (row.doneSets <= 0) return 0
  if (row.plannedSets <= 0) return 100
  return Math.max(3, Math.round(Math.min(1, row.doneSets / row.plannedSets) * 100))
}

/** A region colour deepened for white ground — the `deepMuscle` recipe, by region. */
export function deepRegion(region: RegionKey): string {
  return `color-mix(in srgb,${regionColor(region).rail} 74%,#0A2A3C)`
}

export interface ReachRow { region: RegionKey; label: string; muscle: string; load: LoadLevel }

/** The regions the week's sport and running reach, each with its strongest estimated load
 *  (1–3) and the muscle that carries it — the rows behind `sportReach`'s labels. */
export function reachRows(load: SportLoadResult): ReachRow[] {
  const top = new Map<RegionKey, { muscle: string; load: LoadLevel }>()
  for (const [muscle, sources] of Object.entries(load.perMuscle)) {
    const region = muscleRegion(muscle)
    if (!region) continue
    const strongest = sources.reduce<LoadLevel>((m, s) => (s.load > m ? s.load : m), 1)
    const current = top.get(region)
    if (!current || strongest > current.load) top.set(region, { muscle, load: strongest })
  }
  return REGION_ORDER.filter((r) => top.has(r)).map((region) => ({ region, label: REGION_LABELS[region], ...top.get(region)! }))
}
