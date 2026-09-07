// ============================================================
// Mezo · mesoLoad — a mezo-szerkesztő terhelés-derivációi egy helyen
// (mezo-yty6, spec 2026-09-07-mezo-szerkeszto-redesign): heti izom-terhelés a
// tier-cél ellen (irány + távolság + frekvencia + lebontás), napi izom-terhelés
// a session-cap ellen, és az egymást követő edzésnapok izom-ütközése.
//
// Miért egy modul: a nap-csempesor, a két kompakt csempe, a Napi és a Heti
// terhelés-oldal ugyanazokat a számokat mutatja — két külön számolás előbb-utóbb
// elcsúszik (a dayTiles.ts ugyanezért született).
//
// A modell EGY izomkulcsot tárol gyakorlatonként (GymExercise.muscle), tehát
// nincs szinergista-hasítás: minden gyakorlat a teljes workingSets-ét pontosan
// egy budgetGroup-hoz adja.
// ============================================================
import { DAY_ORDER } from '@/data/train/train'
import type { MesoDay, MusclePriorities, MuscleTier } from '@/data/types'
import { tierOf, tierTargetOf } from '@/features/train/logic/musclePriorities'
import { isOffDay } from '@/features/train/logic/offDay'
import {
  BUDGET_GROUP_LABELS, GROUP_LANDMARKS, SESSION_MUSCLE_CAP, budgetGroup, countsForVolume,
} from '@/features/train/logic/setBudget'

export interface Landmark { mev: number; mav: number; mrv: number }

/** The prototype's day-type washes (Upper/Pull keep the coral default). */
export type DayTone = 'coral' | 'sage' | 'rose' | 'gold'

export function dayTone(type: string): DayTone {
  if (type === 'Lower' || type === 'Legs') return 'sage'
  if (type === 'Push') return 'rose'
  if (type === 'Full') return 'gold'
  return 'coral'
}

export interface ExerciseContribution { exerciseId: string; name: string; sets: number }

export interface DayContribution {
  day: string
  type: string
  sets: number
  exercises: ExerciseContribution[]
}

export interface WeekLoadRow {
  group: string
  label: string
  /** Representative catalog muscle key — feed muscleColor() for the family tokens. */
  colorMuscle: string
  tier: MuscleTier
  /** Working sets planned this week for the group (exempt work excluded). */
  sets: number
  /** The tier's weekly landmark target: maintain→MEV, grow→MAV, emphasize→MRV. */
  target: number
  landmark: Landmark
  /** Training days that hit the group at all. */
  frequency: number
  /** Which way the block has to move to reach `target`. */
  direction: 'up' | 'down' | 'hold'
  /** |target − sets|; 0 when on target. */
  toTarget: number
  contributions: DayContribution[]
}

export interface DayLoadRow {
  group: string
  label: string
  colorMuscle: string
  sets: number
  /** SESSION_MUSCLE_CAP, carried so the view never re-imports the constant. */
  cap: number
  /** At the cap or one set below it — amber, but not a breach. */
  nearCap: boolean
  /** Strictly over the cap. */
  over: boolean
  exercises: ExerciseContribution[]
}

export interface AdjacentConflict {
  fromDay: string
  fromType: string
  toDay: string
  toType: string
  groups: { group: string; label: string }[]
}

const labelOf = (group: string) => BUDGET_GROUP_LABELS[group] ?? group
const dayIndex = (day: string) => DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number])

/** Training days (not off, at least one exercise) in calendar order. */
function trainingDays(days: MesoDay[]): MesoDay[] {
  return days
    .filter((d) => !isOffDay(d) && d.exercises.length > 0)
    .slice()
    .sort((a, b) => dayIndex(a.day) - dayIndex(b.day))
}

/** group -> the exercises contributing to it on this day, in list order. */
function groupExercises(day: MesoDay): Map<string, ExerciseContribution[]> {
  const out = new Map<string, ExerciseContribution[]>()
  for (const ex of day.exercises) {
    if (!countsForVolume(ex)) continue
    const group = budgetGroup(ex.muscle)
    if (!group) continue
    const list = out.get(group) ?? []
    list.push({ exerciseId: ex.id, name: ex.name, sets: ex.workingSets })
    out.set(group, list)
  }
  return out
}

/**
 * Weekly per-group load measured against the group's OWN tier target. Landmarks:
 * explicit `landmarks[group]` → static GROUP_LANDMARKS → row dropped (traps/core carry
 * no landmark, so there is no target to point an arrow at).
 * Sorted by sets desc, ties by label — the spec's "csökkenő sorrend".
 */
export function weekMuscleLoad(
  days: MesoDay[],
  priorities?: MusclePriorities | null,
  landmarks?: Record<string, Landmark> | null,
): WeekLoadRow[] {
  const sets = new Map<string, number>()
  const colorMuscle = new Map<string, string>()
  const contributions = new Map<string, DayContribution[]>()

  for (const day of trainingDays(days)) {
    for (const [group, exercises] of groupExercises(day)) {
      const daySets = exercises.reduce((a, e) => a + e.sets, 0)
      sets.set(group, (sets.get(group) ?? 0) + daySets)
      if (!colorMuscle.has(group)) {
        const first = day.exercises.find((e) => budgetGroup(e.muscle) === group)
        if (first) colorMuscle.set(group, first.muscle)
      }
      const list = contributions.get(group) ?? []
      list.push({ day: day.day, type: day.type, sets: daySets, exercises })
      contributions.set(group, list)
    }
  }

  const rows: WeekLoadRow[] = []
  for (const [group, groupSets] of sets) {
    const landmark = landmarks?.[group] ?? GROUP_LANDMARKS[group] ?? null
    if (!landmark) continue
    const tier = tierOf(priorities, group)
    const target = tierTargetOf(tier, landmark)
    const list = contributions.get(group) ?? []
    // Direction is the TIER's prescriptive cue (does this priority ask for more or
    // less than the group's own growth baseline, landmark.mav?), not a live
    // sets-vs-target reading — that's what toTarget is for. 'hold' only fires when
    // the plan already sits exactly on the target.
    const direction: WeekLoadRow['direction'] =
      groupSets === target ? 'hold' : target >= landmark.mav ? 'up' : 'down'
    rows.push({
      group,
      label: labelOf(group),
      colorMuscle: colorMuscle.get(group) ?? group,
      tier,
      sets: groupSets,
      target,
      landmark,
      frequency: list.length,
      direction,
      toTarget: Math.abs(target - groupSets),
      contributions: list,
    })
  }
  return rows.sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label, 'hu'))
}

/** Per-group load for ONE day against the per-session muscle cap, sets desc. */
export function dayMuscleLoad(day: MesoDay): DayLoadRow[] {
  const rows: DayLoadRow[] = []
  for (const [group, exercises] of groupExercises(day)) {
    const sets = exercises.reduce((a, e) => a + e.sets, 0)
    const first = day.exercises.find((e) => budgetGroup(e.muscle) === group)
    rows.push({
      group,
      label: labelOf(group),
      colorMuscle: first?.muscle ?? group,
      sets,
      cap: SESSION_MUSCLE_CAP,
      nearCap: sets >= SESSION_MUSCLE_CAP - 1 && sets <= SESSION_MUSCLE_CAP,
      over: sets > SESSION_MUSCLE_CAP,
      exercises,
    })
  }
  return rows.sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label, 'hu'))
}

/**
 * Muscle groups trained on two CALENDAR-ADJACENT training days (Hét→Kedd, not Hét→Sze).
 * Passive advice, never a block: a rest day between two sessions for the same group is
 * the recovery default. No prior art in the surveyed apps — our own pattern (spec §4).
 */
export function adjacentDayConflicts(days: MesoDay[]): AdjacentConflict[] {
  const training = trainingDays(days)
  const out: AdjacentConflict[] = []
  for (let i = 0; i < training.length - 1; i++) {
    const from = training[i]
    const to = training[i + 1]
    if (dayIndex(to.day) - dayIndex(from.day) !== 1) continue
    const fromGroups = new Set(groupExercises(from).keys())
    const groups = [...groupExercises(to).keys()]
      .filter((g) => fromGroups.has(g))
      .map((group) => ({ group, label: labelOf(group) }))
    if (groups.length) {
      out.push({ fromDay: from.day, fromType: from.type, toDay: to.day, toType: to.type, groups })
    }
  }
  return out
}
