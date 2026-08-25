// ============================================================
// Mezo · programFit — deterministic rule-engine fitter for generated
// programs (mezo-oyhy.6, spec 2026-08-07). Three phases over a deep copy:
//   1 rep-zone variation — per group, slot 0 keeps the scheme range,
//     later slots shift into a different zone (shoulder isolation → light);
//   2 volume fit — every trained group into [GROUP_MEV, FIT_CEILING) by
//     ±1-set moves within the sets/exercise, session-cap and 90-min limits,
//     with a legality-checked last-resort duplicate removal;
//   3 session-length guard — pad/trim days toward the 45–90 band.
// Pure and deterministic (alphabetical groups, rule-defined tie-breaks);
// exempt exercises (countsForVolume false — plyo, or explicit countsTowardVolume:
// false), off days, warnings and warmupSets pass through untouched.
// Applied by generateProgram as its final step on both return paths.
// ============================================================
import type { GymExercise, MesoDay } from '@/data/types'
import { FAILURE_WEEKLY_CAP, GROUP_MEV, SESSION_MUSCLE_CAP, VOLUME_WEEKLY_CAP, budgetGroup, budgetOf, countsForVolume, setStyle } from '@/features/train/logic/setBudget'
import { SETS_PER_EXERCISE, SESSION_LENGTH_BAND, repZoneOf, type RepZone } from '@/features/train/logic/structureLint'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { isOffDay } from '@/features/train/logic/offDay'

export const FIT_CEILING = 0.85

interface Slot { dayIdx: number; exIdx: number }

// Invariant: only counted exercises reach this — countsForVolume gates every caller
// (slotsOf, daySetsForGroup, guardSessionLength's victims/candidates maps), so a plyo
// or countsTowardVolume:false exercise never gets fed into kindCap. Do not add a plyo
// branch here — fix the caller's gate instead if one is ever found to leak through.
const kindCap = (t: GymExercise['type']) => (t === 'compound' ? SETS_PER_EXERCISE.compound.max : SETS_PER_EXERCISE.isolation.max)

function slotsOf(days: MesoDay[]): Map<string, Slot[]> {
  const map = new Map<string, Slot[]>()
  days.forEach((d, dayIdx) => {
    if (isOffDay(d)) return
    d.exercises.forEach((e, exIdx) => {
      if (!countsForVolume(e)) return
      const group = budgetGroup(e.muscle)
      if (!group) return
      if (!map.has(group)) map.set(group, [])
      map.get(group)!.push({ dayIdx, exIdx })
    })
  })
  return map
}

function groupStats(days: MesoDay[], slots: Slot[]): { sets: number; budget: number } {
  let failure = 0
  let volume = 0
  for (const s of slots) {
    const e = days[s.dayIdx].exercises[s.exIdx]
    if (setStyle(e.targetRIR) === 'failure') failure += e.workingSets
    else volume += e.workingSets
  }
  return { sets: failure + volume, budget: budgetOf(failure, volume) }
}

function daySetsForGroup(days: MesoDay[], group: string, dayIdx: number): number {
  return days[dayIdx].exercises.reduce((a, e) => (countsForVolume(e) && budgetGroup(e.muscle) === group ? a + e.workingSets : a), 0)
}

// --- phase 1 -------------------------------------------------------------
const SHIFT: Record<RepZone, { compound: [number, number]; isolation: [number, number] }> = {
  heavy: { compound: [12, 15], isolation: [12, 15] },
  moderate: { compound: [6, 9], isolation: [20, 25] },
  light: { compound: [12, 15], isolation: [12, 15] },
}

function varyRepZones(days: MesoDay[], slotMap: Map<string, Slot[]>): void {
  for (const [group, slots] of [...slotMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (slots.length < 2) continue
    const first = days[slots[0].dayIdx].exercises[slots[0].exIdx]
    const baseZone = repZoneOf(first.repMin, first.repMax)
    const shift = SHIFT[baseZone]
    slots.forEach((s, i) => {
      if (i === 0) return
      const e = days[s.dayIdx].exercises[s.exIdx]
      // Shoulder isolation always goes light, regardless of the palette cycle below.
      if (group === 'shoulder' && e.type === 'isolation') { e.repMin = 20; e.repMax = 25; return }
      // Palette cycle: odd slots shifted, even slots (2,4,…) back to the base range.
      if (i % 2 === 0) { e.repMin = first.repMin; e.repMax = first.repMax; return }
      const [lo, hi] = shift[e.type === 'compound' ? 'compound' : 'isolation']
      e.repMin = lo
      e.repMax = hi
    })
  }
}

// --- phase 2 -------------------------------------------------------------
function fitVolume(days: MesoDay[], slotMap: Map<string, Slot[]>): void {
  const groups = [...slotMap.keys()].sort()
  for (const group of groups) {
    const mev = GROUP_MEV[group]
    if (mev === undefined) continue
    const slots = slotMap.get(group)!

    // Top up to MEV.
    for (let guard = 0; guard < 64; guard++) {
      if (groupStats(days, slots).sets >= mev) break
      const candidates = slots
        .map((s) => ({ s, e: days[s.dayIdx].exercises[s.exIdx] }))
        .filter(({ s, e }) =>
          e.workingSets < kindCap(e.type)
          && daySetsForGroup(days, group, s.dayIdx) + 1 <= SESSION_MUSCLE_CAP
          && estimateSessionMinutes(days[s.dayIdx].exercises.map((x, i) => (i === s.exIdx ? { ...x, workingSets: x.workingSets + 1 } : x))) <= SESSION_LENGTH_BAND.max)
        .sort((a, b) => a.e.workingSets - b.e.workingSets || a.s.dayIdx - b.s.dayIdx || a.s.exIdx - b.s.exIdx)
      if (candidates.length === 0) break
      candidates[0].e.workingSets++
    }

    // Trim below the ceiling.
    for (let guard = 0; guard < 64; guard++) {
      if (groupStats(days, slots).budget < FIT_CEILING) break
      const candidates = slots
        .map((s) => ({ s, e: days[s.dayIdx].exercises[s.exIdx] }))
        .filter(({ e }) => e.workingSets > 2)
        .sort((a, b) => b.e.workingSets - a.e.workingSets || b.s.dayIdx - a.s.dayIdx || b.s.exIdx - a.s.exIdx)
      if (candidates.length === 0) { tryRemoveDuplicate(days, slotMap, group); break }
      candidates[0].e.workingSets--
    }
  }
}

/** Last resort at floors: remove ONE duplicate slot when legal (frequency, variety, session-size). */
function tryRemoveDuplicate(days: MesoDay[], slotMap: Map<string, Slot[]>, group: string): void {
  const slots = slotMap.get(group)!
  if (groupStats(days, slots).budget < FIT_CEILING) return
  // Candidates: later days first, later slots first.
  const ordered = [...slots].sort((a, b) => b.dayIdx - a.dayIdx || b.exIdx - a.exIdx)
  for (const cand of ordered) {
    const sameDay = slots.filter((s) => s.dayIdx === cand.dayIdx).length
    if (sameDay < 2) continue // frequency: keep ≥1 group slot on each of its days
    const names = new Set(slots.filter((s) => s !== cand).map((s) => days[s.dayIdx].exercises[s.exIdx].name))
    if (names.size < 2) continue // variety
    if (days[cand.dayIdx].exercises.length - 1 < 5) continue // session size
    const mev = GROUP_MEV[group]
    if (mev !== undefined && groupStats(days, slots.filter((s) => s !== cand)).sets < mev) continue // MEV floor
    const d = days[cand.dayIdx]
    d.exercises = d.exercises.filter((_, i) => i !== cand.exIdx)
    d.exerciseCount = d.exercises.length
    // Rebuild the slot map after a structural change and stop (single removal).
    const rebuilt = slotsOf(days)
    slotMap.clear()
    for (const [g, s] of rebuilt) slotMap.set(g, s)
    return
  }
}

// --- phase 3 -------------------------------------------------------------
function guardSessionLength(days: MesoDay[], slotMap: Map<string, Slot[]>): void {
  days.forEach((d, dayIdx) => {
    if (isOffDay(d) || d.exercises.length === 0) return
    for (let guard = 0; guard < 32; guard++) {
      const est = estimateSessionMinutes(d.exercises)
      if (est > SESSION_LENGTH_BAND.max) {
        const victims = d.exercises
          .map((e, exIdx) => ({ e, exIdx, group: countsForVolume(e) ? budgetGroup(e.muscle) : null }))
          .filter(({ e, group }) => group !== null && e.workingSets > 2)
          .filter(({ group }) => {
            const mev = GROUP_MEV[group!]
            return mev === undefined || groupStats(days, slotMap.get(group!) ?? []).sets - 1 >= mev
          })
          .sort((a, b) => b.e.workingSets - a.e.workingSets || b.exIdx - a.exIdx)
        if (victims.length === 0) break
        victims[0].e.workingSets--
      } else if (est < SESSION_LENGTH_BAND.min) {
        const candidates = d.exercises
          .map((e, exIdx) => ({ e, exIdx, group: countsForVolume(e) ? budgetGroup(e.muscle) : null }))
          .filter(({ e, group }) => group !== null && e.workingSets < kindCap(e.type)
            && daySetsForGroup(days, group!, dayIdx) + 1 <= SESSION_MUSCLE_CAP)
          .map((c) => {
            const slots = slotMap.get(c.group!) ?? []
            const cur = groupStats(days, slots)
            const style = setStyle(c.e.targetRIR)
            const nextBudget = cur.budget + (style === 'failure' ? 1 / FAILURE_WEEKLY_CAP : 1 / VOLUME_WEEKLY_CAP)
            return { ...c, nextBudget }
          })
          // The session-length band is a hard rule (structureLint R5) — it must never lose to the
          // FIT_CEILING soft ceiling (waivable via NEAR_ALLOWED in the invariant suite). Padding here
          // only has to respect the one truly hard budget bound: <= 1 (structureLint 'budget' rule).
          .filter((c) => c.nextBudget <= 1)
          .sort((a, b) => a.nextBudget - b.nextBudget || a.exIdx - b.exIdx)
        if (candidates.length === 0) break
        candidates[0].e.workingSets++
      } else break
    }
  })
}

/** Deterministic rule-engine fit; see module header. `_goalId` reserved for goal-aware fitting. */
export function fitProgram(days: MesoDay[], _goalId: string): MesoDay[] {
  const copy: MesoDay[] = days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }))
  const slotMap = slotsOf(copy)
  varyRepZones(copy, slotMap)
  fitVolume(copy, slotMap)
  guardSessionLength(copy, slotMap)
  copy.forEach((d) => { d.exerciseCount = d.exercises.length })
  return copy
}
