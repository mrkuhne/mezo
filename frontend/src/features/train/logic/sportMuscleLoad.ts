// ============================================================
// Mezo · sportMuscleLoad — static per-sport-kind muscle→load heuristic
// (mezo-ly27 muscle-week sheet, spec §1.2). A PRODUCT HEURISTIC, not
// physiology ground truth: honest "~ becslés" labeling in the UI; the
// Phase-3 cross-load engine replaces this table wholesale (train.md §Phase-3).
// Inputs are live in both modes: the weekly sport schedule slots + the
// active running block's current-week prescribed sessions.
// ============================================================
import type { VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import { DAY_ORDER } from '@/data/train/train'
import { SPORT_LABELS, SPORT_TAGS, sportOf } from '@/features/train/logic/sportKinds'
import { muscleRegion, REGION_LABELS, REGION_ORDER, type RegionKey } from '@/features/train/logic/muscleColors'

export type SportLoadKind = 'volleyball' | 'cross' | 'trx' | 'run-steady' | 'run-sprint'
export type LoadLevel = 1 | 2 | 3

const LOAD_TABLE: Record<SportLoadKind, Record<string, LoadLevel>> = {
  volleyball: { shoulder: 3, 'rear-delt': 1, quad: 2, calf: 2, core: 1 },
  cross: { quad: 2, glute: 2, core: 2, shoulder: 1, triceps: 1 },
  trx: { core: 3, 'back-mid': 2, lats: 1, biceps: 1, triceps: 1, shoulder: 1 },
  'run-steady': { quad: 2, ham: 1, calf: 2, core: 1 },
  'run-sprint': { quad: 3, ham: 3, glute: 2, calf: 2, core: 1 },
}
const KIND_CHIP_LABELS: Record<SportLoadKind, string> = {
  volleyball: SPORT_LABELS.volleyball, cross: SPORT_LABELS.cross, trx: SPORT_LABELS.trx,
  'run-steady': 'futás', 'run-sprint': 'futás',
}
const KIND_TITLES: Record<'volleyball' | 'cross' | 'trx', string> = {
  volleyball: 'Röplabda', cross: 'Cross training', trx: 'TRX köredzés',
}

export interface MuscleLoadSource { kind: SportLoadKind; label: string; load: LoadLevel; count: number }
export interface SportLoadEvent {
  kind: SportLoadKind
  tag: string
  title: string
  day: string
  time: string | null
  regionLoads: { region: RegionKey; label: string; load: LoadLevel }[]
}
export interface SportLoadResult { perMuscle: Record<string, MuscleLoadSource[]>; events: SportLoadEvent[] }

const runKind = (kind: string): SportLoadKind =>
  kind === 'sprint' || kind === 'pyramid' ? 'run-sprint' : 'run-steady'

/** Region-aggregated loads of one kind's table row (max load per region, fixed order). */
function regionLoads(kind: SportLoadKind): SportLoadEvent['regionLoads'] {
  const byRegion = new Map<RegionKey, LoadLevel>()
  for (const [muscle, load] of Object.entries(LOAD_TABLE[kind])) {
    const region = muscleRegion(muscle)
    if (!region) continue
    byRegion.set(region, Math.max(byRegion.get(region) ?? 0, load) as LoadLevel)
  }
  return REGION_ORDER.filter((r) => byRegion.has(r))
    .map((region) => ({ region, label: REGION_LABELS[region], load: byRegion.get(region)! }))
}

export function sportLoadForWeek(slots: VolleyballSession[], runSessions: RunPrescribedSession[]): SportLoadResult {
  const perMuscle: Record<string, MuscleLoadSource[]> = {}
  const events: SportLoadEvent[] = []

  const addEvent = (kind: SportLoadKind, tag: string, title: string, day: string, time: string | null) => {
    events.push({ kind, tag, title, day, time, regionLoads: regionLoads(kind) })
    for (const [muscle, load] of Object.entries(LOAD_TABLE[kind])) {
      const sources = (perMuscle[muscle] ??= [])
      const existing = sources.find((s) => s.kind === kind)
      if (existing) existing.count += 1
      else sources.push({ kind, label: KIND_CHIP_LABELS[kind], load, count: 1 })
    }
  }

  for (const slot of slots) {
    const sport = sportOf(slot)
    addEvent(sport, SPORT_TAGS[sport], KIND_TITLES[sport], slot.day, slot.time || null)
  }
  for (const s of runSessions) {
    addEvent(runKind(s.kind), 'FUTÁS', s.label, DAY_ORDER[s.dayOfWeek] ?? '', s.timeOfDay ?? null)
  }
  for (const sources of Object.values(perMuscle)) sources.sort((a, b) => b.load - a.load)
  return { perMuscle, events }
}
