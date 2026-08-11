// ============================================================
// Mezo · summaryStats — pure derivations for the WorkoutSummary redesign
// (mezo-w943): totals, muscle-region pills, RECORD/TARGET medal split and
// the per-exercise set-chip map (record/top/ghost marking). Table-tested;
// keeps WorkoutSummary.tsx presentational.
// ============================================================
import type { Medal } from '@/data/train/medalTypes'
import { REGION_LABELS, REGION_ORDER, muscleRegion, type RegionKey } from '@/features/train/logic/muscleColors'

// Local set shape (not `LastWeekSet`): RIR is honestly `number | null` here — the review-mode
// caller's warmup sets carry no RIR at all (the API contract's `rir` is null on every warmup
// row), and averaging that as 0 would drag Ø RIR toward zero and disagree with the SAME
// workout's in-memory `complete`-phase average (mezo-w943 final review, Finding 1). Field
// names match `LastWeekSet` on purpose so the closing-mode caller's `LastWeekSet[]` (always
// a real number — the active session never logs a null RIR) stays assignable here.
export interface SummarySet { weight: number; reps: number; rir: number | null }
export interface SummaryExerciseInput {
  id: string
  name: string
  muscle: string
  plannedSets: number
  sets: SummarySet[]
  skipped: boolean
}
export interface SummarySetChip { weight: number; reps: number; rir: number | null; record: boolean; top: boolean }
export interface SummaryExerciseView {
  id: string; name: string; muscle: string
  plannedSets: number; doneSets: number
  abandoned: boolean
  partial: boolean
  missing: number
  /** Explicitly skipped mid-exercise (some sets logged, then abandoned) — distinct from
   *  `abandoned` (zero sets logged at all); drives the `· kihagyva` marker on a partial card. */
  skipped: boolean
  chips: SummarySetChip[]
}
export interface RegionPill { region: RegionKey; label: string; sets: number; off: boolean }
export interface TargetGroup { exerciseName: string; count: number }
export interface SummaryStats {
  doneSets: number; plannedSets: number
  doneEx: number; totalEx: number
  volumeT: number
  avgRir: number | null
  regions: RegionPill[]
  records: Medal[]
  targetGroups: TargetGroup[]
  targetCount: number
  exercises: SummaryExerciseView[]
}

/** The heaviest set's index — ties break to more reps, then to the earlier set. */
function topSetIndex(sets: SummarySet[]): number {
  let best = -1
  sets.forEach((s, i) => {
    if (best === -1) { best = i; return }
    const b = sets[best]
    if (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps)) best = i
  })
  return best
}

/** Chip index a RECORD medal points at: valid setIndex wins, else first weight+reps match. */
function recordChipIndex(medal: Medal, sets: SummarySet[]): number {
  if (medal.setIndex != null && medal.setIndex >= 0 && medal.setIndex < sets.length) return medal.setIndex
  if (medal.weightKg != null && medal.reps != null) {
    return sets.findIndex((s) => s.weight === medal.weightKg && s.reps === medal.reps)
  }
  return -1
}

export function deriveSummaryStats(exercises: SummaryExerciseInput[], medals: Medal[]): SummaryStats {
  const records = medals.filter((m) => m.tier === 'RECORD')
  const targets = medals.filter((m) => m.tier === 'TARGET')

  const views: SummaryExerciseView[] = exercises.map((e) => {
    const chips: SummarySetChip[] = e.sets.map((s) => ({ ...s, record: false, top: false }))
    for (const m of records) {
      if (m.exerciseName !== e.name) continue
      const idx = recordChipIndex(m, e.sets)
      if (idx >= 0) chips[idx].record = true
    }
    const top = topSetIndex(e.sets)
    if (top >= 0 && !chips[top].record) chips[top].top = true
    const doneSets = e.sets.length
    return {
      id: e.id, name: e.name, muscle: e.muscle,
      plannedSets: e.plannedSets, doneSets,
      abandoned: doneSets === 0,
      partial: doneSets > 0 && doneSets < e.plannedSets,
      missing: Math.max(0, e.plannedSets - doneSets),
      skipped: e.skipped,
      chips,
    }
  })

  const byRegion = new Map<RegionKey, number>()
  for (const e of exercises) {
    const region = muscleRegion(e.muscle)
    if (!region) continue
    byRegion.set(region, (byRegion.get(region) ?? 0) + e.sets.length)
  }
  const on = [...byRegion.entries()].filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || REGION_ORDER.indexOf(a[0]) - REGION_ORDER.indexOf(b[0]))
  const off = [...byRegion.entries()].filter(([, n]) => n === 0)
    .sort((a, b) => REGION_ORDER.indexOf(a[0]) - REGION_ORDER.indexOf(b[0]))
  const regions: RegionPill[] = [...on, ...off].map(([region, sets]) => ({
    region, label: REGION_LABELS[region], sets, off: sets === 0,
  }))

  const targetByName = new Map<string, number>()
  for (const m of targets) targetByName.set(m.exerciseName, (targetByName.get(m.exerciseName) ?? 0) + 1)
  const targetGroups: TargetGroup[] = [...targetByName.entries()]
    .map(([exerciseName, count]) => ({ exerciseName, count }))
    .sort((a, b) => b.count - a.count)

  const allSets = exercises.flatMap((e) => e.sets)
  const volumeT = allSets.reduce((a, s) => a + s.weight * s.reps, 0) / 1000
  // Ø RIR honesty (Finding 1): a warmup set logs no RIR at all — average only the sets that
  // actually carry one, never fabricate a 0 for the rest.
  const ratedSets = allSets.filter((s): s is SummarySet & { rir: number } => s.rir != null)
  const avgRir = ratedSets.length === 0 ? null : Math.round((ratedSets.reduce((a, s) => a + s.rir, 0) / ratedSets.length) * 10) / 10

  return {
    doneSets: allSets.length,
    plannedSets: exercises.reduce((a, e) => a + e.plannedSets, 0),
    doneEx: views.filter((v) => !v.abandoned).length,
    totalEx: exercises.length,
    volumeT, avgRir, regions, records, targetGroups,
    targetCount: targets.length,
    exercises: views,
  }
}
