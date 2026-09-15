// ============================================================
// Mezo · dayImpact — the day's muscles, in words (Train Titanium T5 "Mai"
// face, mezo-88iwa.6). Per-REGION sum of planned working sets, translated
// into the prototype's plain-language ladder (train-pages.js:36) instead of
// raw set counts. Zero UI imports — pure module, table-tested.
// ============================================================
import { muscleRegion, REGION_LABELS, REGION_ORDER, type RegionKey } from '@/features/train/logic/muscleColors'

export type DayImpactRow = {
  region: string // muscleColors region id (6 families)
  label: string // REGION_LABELS[region]
  token: string // the region's heaviest muscle token (for MuscleChip)
  plannedSets: number
  doneSets: number
  word: 'ma nem kap' | 'enyhe' | 'közepes' | 'erős'
}

/** The four big families the prototype always shows, even when today gives them nothing. */
const BIG_FAMILIES: readonly RegionKey[] = ['coral', 'sky', 'lav', 'sage'] // Mell / Hát / Váll / Láb

function impactWord(plannedSets: number): DayImpactRow['word'] {
  if (plannedSets === 0) return 'ma nem kap'
  if (plannedSets <= 3) return 'enyhe'
  if (plannedSets <= 6) return 'közepes'
  return 'erős'
}

export function dayImpact(
  exercises: Array<{ muscle: string; workingSets: number }>,
  doneByMuscle: Record<string, number> = {},
): DayImpactRow[] {
  const plannedByRegion = new Map<RegionKey, number>()
  const tokenSetsByRegion = new Map<RegionKey, Map<string, number>>()

  for (const ex of exercises) {
    const region = muscleRegion(ex.muscle)
    if (!region) continue // unknown token — no region to attribute it to
    plannedByRegion.set(region, (plannedByRegion.get(region) ?? 0) + ex.workingSets)
    const tokenSets = tokenSetsByRegion.get(region) ?? new Map<string, number>()
    tokenSets.set(ex.muscle, (tokenSets.get(ex.muscle) ?? 0) + ex.workingSets)
    tokenSetsByRegion.set(region, tokenSets)
  }

  const doneByRegion = new Map<RegionKey, number>()
  for (const [muscle, sets] of Object.entries(doneByMuscle)) {
    const region = muscleRegion(muscle)
    if (!region) continue
    doneByRegion.set(region, (doneByRegion.get(region) ?? 0) + sets)
  }

  const rows: DayImpactRow[] = []
  for (const region of REGION_ORDER) {
    const plannedSets = plannedByRegion.get(region) ?? 0
    if (plannedSets === 0 && !BIG_FAMILIES.includes(region)) continue // Kar/Core: 0 is silent

    const tokenSets = tokenSetsByRegion.get(region)
    let token = ''
    let bestSets = -1
    if (tokenSets) {
      for (const [candidate, sets] of tokenSets) {
        if (sets > bestSets) {
          bestSets = sets
          token = candidate
        }
      }
    }

    rows.push({
      region,
      label: REGION_LABELS[region],
      token,
      plannedSets,
      doneSets: doneByRegion.get(region) ?? 0, // raw — the bar caps it at render time, not here
      word: impactWord(plannedSets),
    })
  }

  return rows.sort((a, b) => b.plannedSets - a.plannedSets) // stable: REGION_ORDER breaks ties
}
