// Fuel P5 — deterministic day-planner core.
//
// Pure logic: given the user's wake/bed rhythm, the day's REAL training blocks, a daily
// kcal/macro budget, the day's logged meals, a recipe catalog, the supplement protocol and
// the day's intakes, it composes a `FuelPlanToday` (meal windows around the workouts, per-slot
// budgets, recipe suggestions, supplement + block slots, fixed-plan missed/now/pending state, the
// dynamic-energy breakdown). Windows sit at their ANCHORED times — the plan does not re-flow around
// `now` (mezo-1oy5); `now` only classifies each window's state. No ambient time (no Date.now /
// `new Date()` / random): `nowHHmm` is injected; logged-at strings are parsed deterministically via
// `new Date(iso)`. Design: docs/superpowers/specs/2026-07-02-fuel-p5-merged-timeline-design.md §3.

import {
  DEFAULT_BLOCK_MIN,
  DEFAULT_RUN_MIN,
  EATING_START_OFFSET_MIN,
  FAT_KCAL_SHARE,
  KITCHEN_CLOSE_OFFSET_MIN,
  MET_BY_KIND,
  MIN_SLOT_GAP_MIN,
  PERI_SNACK_MIN_DURATION,
  PERI_SNACK_MIN_KCAL,
  POST_WORKOUT_SNAP_MIN,
  PRE_WORKOUT_SNAP_MIN,
  RECIPE_FIT_TOLERANCE,
  ROLE_MACRO_MULTIPLIERS,
  SLOT_WEIGHT,
  daySpan,
  toHHmm,
  toMin,
  unwrapDayMinute,
} from '@/data/fuel/fuelConfig'
import { compileTemplate } from '@/features/fuel/logic/compileTemplate'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import type {
  FuelKind,
  FuelMeal,
  FuelPlanToday,
  FuelSlot,
  MacroSet,
  Recipe,
  RecipeRole,
  SlotItem,
  SlotTemplate,
  StackZoneKey,
} from '@/data/types'
import type { StackDaySlot } from '@/features/fuel/logic/projectStackDay'

// ── Public interfaces ────────────────────────────────────────────────────────
export interface PlannerBlock {
  kind: 'gym' | 'sport' | 'run'
  time: string
  durationMin: number | null
  label: string
}
export interface DayPlanInput {
  wake: string
  bed: string
  mealsPerDay: number
  blocks: PlannerBlock[]
  /** Bodyweight (kg) — only feeds the peri-snack kcal threshold; 0 → duration rule only. */
  weightKg?: number
  budget: DayBudget
  meals: FuelMeal[]
  recipes: Recipe[]
  protocolSlots: StackDaySlot[]
  caffeineCutoff: string
  nowHHmm: string
  /** A per-day-type slot template (mezo-7102) — when present, windows come from `compileTemplate`
   *  + `splitBudgetPct` instead of `placeWindows` + `splitBudget`. Absent/null keeps today's behavior. */
  template?: SlotTemplate | null
}

export type SlotKey = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export interface Macro4 {
  kcal: number
  p: number
  c: number
  f: number
}
/** A placed meal/snack window before it becomes a `FuelSlot` — `time` is minutes since midnight
 *  (may be fractional until `toHHmm`-rendered), `weight` drives the budget split. */
export interface PlannedWindow {
  slotKey: SlotKey
  kind: 'meal' | 'snack'
  label: string
  time: number
  weight: number
  /** Set only by `compileTemplate` (mezo-7102) — the row's fixed budget share; `placeWindows`
   *  leaves it undefined (its `weight` is the live signal there). */
  budgetPct?: number
  /** Set only by `compileTemplate` (mezo-7102) — carries the template row's recipe role through. */
  role?: RecipeRole
}

const MACRO_KEYS: (keyof Macro4)[] = ['kcal', 'p', 'c', 'f']

// ── mealSlotKey ──────────────────────────────────────────────────────────────
// Real mode: `FuelMeal.slot` is the enum ('breakfast'|'lunch'|'dinner'|'snack').
// Mock mode: it is a Hungarian display string ('Reggeli · 09:15 · post-workout', 'Ebéd · 13:00', …).
// Both are recognised; unknown → null (the meal is dropped from window filling).
export function mealSlotKey(m: FuelMeal): SlotKey | null {
  const s = (m.slot ?? '').toLowerCase()
  if (s === 'breakfast' || s.includes('reggeli')) return 'breakfast'
  if (s === 'lunch' || s.includes('ebéd') || s.includes('ebed')) return 'lunch'
  if (s === 'dinner' || s.includes('vacsora')) return 'dinner'
  if (s === 'snack' || s.includes('snack')) return 'snack'
  return null
}

// ── MET-based activity energy ────────────────────────────────────────────────
/** MET-based kcal for one training block. Null duration → DEFAULT_RUN_MIN for runs, DEFAULT_BLOCK_MIN otherwise. */
export function blockKcal(kind: PlannerBlock['kind'], durationMin: number | null, weightKg: number): number {
  const met = MET_BY_KIND[kind] ?? MET_BY_KIND.default
  const min = durationMin ?? (kind === 'run' ? DEFAULT_RUN_MIN : DEFAULT_BLOCK_MIN)
  return met * weightKg * (min / 60)
}
/** Total scheduled activity energy (kcal) for the day — every gym/sport/run block. */
export function activityKcal(blocks: PlannerBlock[], weightKg: number): number {
  return blocks.reduce((s, b) => s + blockKcal(b.kind, b.durationMin, weightKg), 0)
}

// ── deriveDailyBudget ────────────────────────────────────────────────────────
export interface EnergyInputs { bmr: number | null; neat: number | null; weightKg: number; blocks: PlannerBlock[] }
export interface DayBudget extends Macro4 { energy: { base: number; activity: number; balance: number; target: number } }

/**
 * Daily budget. Static path (no BMR/NEAT → no biometric profile) keeps today's behavior. Dynamic path
 * (mezo-1oy5 / mezo-eujg): target = BMR×neat + Σ MET activity + goal balance, floored at BMR. Protein is
 * fixed (bodyweight-based); fat prefers the segment's prescribed `fatG` (Diet Plan slice 1 — mezo-xwgb),
 * falling back to the BASE-segment-kcal FAT_KCAL_SHARE share for pre-slice-1 segments (no jump for
 * data that predates the split). Carbs absorb the activity bonus in the dynamic path; in the static
 * path they prefer the segment's prescribed `carbsG`, falling back to the same remainder formula.
 * balance = segment.dailyEnergyBalanceKcal (explicit goal deficit/surplus from the wire).
 * maintenance = BMR×neat (NEAT lifestyle multiplier from the bootstrap).
 *
 * Day-type shift (Diet Plan slice 3 — mezo-sxlj): `isTrainingDay` picks the segment's
 * `trainingDayKcal`/`restDayKcal` as the day's kcal base instead of its uniform `kcal`; `undefined`
 * (untouched callers/tests) keeps the pre-slice-3 uniform behavior byte-identical. Fat stays
 * DAY-INDEPENDENT — its FAT_KCAL_SHARE fallback always uses the uniform segment kcal, never the
 * day-type kcal, so a day-type shift never redistributes fat. Static path carbs absorb the day-type
 * delta against the segment's own prescribed `carbsG` (mirrors the BE's serve-time carb-delta rule);
 * dynamic path folds the delta into the target kcal and carbs absorb it same as the activity bonus.
 */
export function deriveDailyBudget(
  segment: {
    kcal: number; proteinG: number; carbsG?: number | null; fatG?: number | null; dailyEnergyBalanceKcal?: number
    trainingDayKcal?: number | null; restDayKcal?: number | null
  } | null,
  fallback: MacroSet,
  energy?: EnergyInputs,
  /** Day-type pick (slice 3): true/false applies the segment's training/rest kcal; undefined = uniform. */
  isTrainingDay?: boolean,
): DayBudget {
  const dayKcal = segment == null || isTrainingDay === undefined
    ? null
    : (isTrainingDay ? segment.trainingDayKcal : segment.restDayKcal) ?? null
  const uniformKcal = segment?.kcal ?? fallback.kcal
  const baseKcal = dayKcal ?? uniformKcal
  const proteinG = segment?.proteinG ?? fallback.p
  // Prescribed fat wins (Diet Plan slice 1); FAT_KCAL_SHARE remains the pre-slice-1 fallback. The
  // fallback share is tied to the UNIFORM segment kcal (not the day-type kcal) — fat never varies
  // by day type.
  const fat = segment?.fatG ?? Math.round((uniformKcal * FAT_KCAL_SHARE) / 9)
  const carbs = (kcal: number) => Math.max(0, Math.round((kcal - proteinG * 4 - fat * 9) / 4))

  if (!energy || energy.bmr == null || energy.neat == null) {
    // Static path (no biometric profile) keeps today's behavior: no segment → the fallback MacroSet
    // passes through verbatim (only water dropped); a segment carries kcal+proteinG, so derive c/f
    // (preferring the segment's own prescribed carbsG when present, offset by the day-type delta —
    // mirrors the BE's serve-time carb-delta rule; without a day type this reduces to `carbsG` as-is).
    if (!segment) {
      return { kcal: fallback.kcal, p: fallback.p, c: fallback.c, f: fallback.f, energy: { base: fallback.kcal, activity: 0, balance: 0, target: fallback.kcal } }
    }
    const c = segment.carbsG != null ? segment.carbsG + Math.round((baseKcal - segment.kcal) / 4) : carbs(baseKcal)
    return { kcal: baseKcal, p: proteinG, c, f: fat, energy: { base: baseKcal, activity: 0, balance: 0, target: baseKcal } }
  }
  const balance = segment?.dailyEnergyBalanceKcal ?? 0
  const dayTypeDelta = dayKcal != null && segment != null ? dayKcal - segment.kcal : 0
  const maintenance = energy.bmr * energy.neat
  const eat = activityKcal(energy.blocks, energy.weightKg)
  const target = Math.max(energy.bmr, maintenance + eat + balance + dayTypeDelta) // KCAL_FLOOR = BMR
  return {
    kcal: Math.round(target),
    p: proteinG,
    c: carbs(target), // carbs stay the absorber of the day's activity bonus + day-type delta, off the prescribed fat
    f: fat,
    energy: { base: Math.round(maintenance), activity: Math.round(eat), balance: Math.round(balance), target: Math.round(target) },
  }
}

// ── placeWindows ─────────────────────────────────────────────────────────────
// Spread the mealsPerDay structure across the eating span (wake+45 → kitchenClose = bed−90):
// mains Reggeli/Ebéd/Vacsora at span fractions 0/0.5/1; snacks between. Then a SINGLE training snap
// around the whole envelope (nearest main to the LATEST block end → +45, weight 2.5; nearest window
// before the EARLIEST block start → −75) so concurrent blocks can't each drag a main and collide;
// clamp into [eatingStart, kitchenClose], and forward-push to keep MIN_SLOT_GAP_MIN spacing.
export function placeWindows(
  wake: string,
  bed: string,
  mealsPerDay: number,
  blocks: PlannerBlock[],
  weightKg = 0,
): PlannedWindow[] {
  const eatingStart = toMin(wake) + EATING_START_OFFSET_MIN
  const kitchenClose = toMin(bed) - KITCHEN_CLOSE_OFFSET_MIN
  const span = kitchenClose - eatingStart
  const at = (frac: number) => eatingStart + frac * span
  const clamp = (t: number) => Math.min(kitchenClose, Math.max(eatingStart, t))

  const reggeli: PlannedWindow = { slotKey: 'breakfast', kind: 'meal', label: 'Reggeli', time: at(0), weight: SLOT_WEIGHT.main }
  const ebed: PlannedWindow = { slotKey: 'lunch', kind: 'meal', label: 'Ebéd', time: at(0.5), weight: SLOT_WEIGHT.main }
  const vacsora: PlannedWindow = { slotKey: 'dinner', kind: 'meal', label: 'Vacsora', time: at(1), weight: SLOT_WEIGHT.main }
  const windows: PlannedWindow[] = [reggeli, ebed, vacsora]

  const snack = (time: number, label: string): PlannedWindow => ({ slotKey: 'snack', kind: 'snack', label, time, weight: SLOT_WEIGHT.snack })
  const meals = Math.max(3, Math.min(6, mealsPerDay))
  if (meals >= 4) windows.push(snack((ebed.time + vacsora.time) / 2, 'Uzsonna')) // after Ebéd
  if (meals >= 5) windows.push(snack((reggeli.time + ebed.time) / 2, 'Tízórai')) // between Reggeli–Ebéd
  if (meals >= 6) windows.push(snack(vacsora.time - MIN_SLOT_GAP_MIN, 'Esti snack')) // evening: Vacsora−90

  // Peri-workout snack (mezo-1oy5): each significant block earns a light pre-session fuel window
  // (the post side is covered by the post-workout main snap). Deduped against existing windows by min-gap.
  for (const b of blocks) {
    const dur = b.durationMin ?? DEFAULT_BLOCK_MIN
    const significant = dur >= PERI_SNACK_MIN_DURATION || blockKcal(b.kind, b.durationMin, weightKg) >= PERI_SNACK_MIN_KCAL
    if (!significant) continue
    const t = clamp(toMin(b.time) - 60)
    if (windows.some(w => Math.abs(w.time - t) < MIN_SLOT_GAP_MIN)) continue
    windows.push(snack(t, 'Pre-workout snack'))
  }

  // Training snaps — a SINGLE snap around the whole training envelope (mezo-1oy5). Two concurrent
  // blocks (e.g. gym + volleyball both at 18:00) must not each drag their own nearest main and
  // collide: instead snap ONE post-workout main to the LATEST block end and ONE pre-fuel window
  // to the EARLIEST block start.
  if (blocks.length) {
    const starts = blocks.map(b => toMin(b.time))
    const ends = blocks.map(b => toMin(b.time) + (b.durationMin ?? DEFAULT_BLOCK_MIN))
    const earliestStart = Math.min(...starts)
    const latestEnd = Math.max(...ends)
    // Post-workout main = the main meal nearest the LATEST block end; snapped to latestEnd+45, weighted up.
    const post = windows.filter(w => w.kind === 'meal').sort((a, z) => Math.abs(a.time - latestEnd) - Math.abs(z.time - latestEnd))[0]
    if (post) {
      post.time = clamp(latestEnd + POST_WORKOUT_SNAP_MIN)
      post.weight = SLOT_WEIGHT.postWorkoutMain
    }
    // Pre-fuel = nearest window strictly before the EARLIEST block start (excluding post), snapped to −75.
    const pre = windows.filter(w => w !== post && w.time < earliestStart).sort((a, z) => z.time - a.time)[0]
    if (pre) pre.time = clamp(earliestStart - PRE_WORKOUT_SNAP_MIN)
  }

  for (const w of windows) w.time = clamp(w.time)
  windows.sort((a, z) => a.time - z.time)
  for (let i = 1; i < windows.length; i++) {
    if (windows[i].time < windows[i - 1].time + MIN_SLOT_GAP_MIN) {
      windows[i].time = Math.min(kitchenClose, windows[i - 1].time + MIN_SLOT_GAP_MIN)
    }
  }
  return windows
}

// ── splitBudget ──────────────────────────────────────────────────────────────
// Daily budget → per-window budget by weight, each macro Math.round-ed. The rounding drift is
// absorbed by the dinner window so Σ slot budgets === daily budget exactly, per macro.
export function splitBudget(budget: Macro4, windows: PlannedWindow[]): Macro4[] {
  const total = windows.reduce((s, w) => s + w.weight, 0) || 1
  const out = windows.map(w => {
    const b = { kcal: 0, p: 0, c: 0, f: 0 } as Macro4
    for (const k of MACRO_KEYS) b[k] = Math.round((budget[k] * w.weight) / total)
    return b
  })
  const dinnerIdx = windows.findIndex(w => w.slotKey === 'dinner')
  if (dinnerIdx >= 0) {
    for (const k of MACRO_KEYS) {
      const sum = out.reduce((s, b) => s + b[k], 0)
      out[dinnerIdx][k] += budget[k] - sum
    }
  }
  return out
}

// ── splitBudgetPct ───────────────────────────────────────────────────────────
// Template windows (mezo-7102) carry an explicit `budgetPct` (and a recipe `role`) instead of a
// live `weight` — kcal splits straight by pct; P/C/F split by pct × the row's ROLE_MACRO_MULTIPLIERS,
// then each macro COLUMN is renormalized so it still sums to the daily budget. Rounding drift is
// absorbed by the largest-pct window (the `placeWindows`/`splitBudget` dinner-absorbs principle,
// generalized: dinner is usually the biggest slot, but a template's biggest slot may be any row).
export function splitBudgetPct(budget: Macro4, windows: PlannedWindow[]): Macro4[] {
  // A template's rows can ALL be training-anchored and get defensively dropped by compileTemplate
  // on a blockless day (or a cached mock-mode template can carry `slots: []`) — no window means no
  // largest-pct index to absorb drift into, so bail before that reduce ever runs.
  if (!windows.length) return []
  const totalPct = windows.reduce((s, w) => s + (w.budgetPct ?? 0), 0) || 1
  const share = (w: PlannedWindow) => (w.budgetPct ?? 0) / totalPct
  // kcal: straight pct
  const out = windows.map(w => ({ kcal: Math.round(budget.kcal * share(w)), p: 0, c: 0, f: 0 }) as Macro4)
  // p/c/f: pct share × role multiplier, then normalize the column so Σ === budget[k]
  for (const k of ['p', 'c', 'f'] as const) {
    const raw = windows.map(w => share(w) * (ROLE_MACRO_MULTIPLIERS[w.role ?? 'standard'][k]))
    const rawSum = raw.reduce((s, x) => s + x, 0) || 1
    windows.forEach((_, i) => { out[i][k] = Math.round((budget[k] * raw[i]) / rawSum) })
  }
  // absorb drift per macro into the largest-pct slot (the dinner-absorbs principle)
  const bigIdx = windows.reduce((bi, w, i) => ((w.budgetPct ?? 0) > (windows[bi].budgetPct ?? 0) ? i : bi), 0)
  for (const k of ['kcal', 'p', 'c', 'f'] as const) {
    const sum = out.reduce((s, b) => s + b[k], 0)
    out[bigIdx][k] += budget[k] - sum
  }
  return out
}

// ── recipe fit ───────────────────────────────────────────────────────────────
export function perServing(r: Recipe): Macro4 {
  const s = r.servings || 1
  return { kcal: r.macros.kcal / s, p: r.macros.p / s, c: r.macros.c / s, f: r.macros.f / s }
}
function roundMacro(m: Macro4): Macro4 {
  return { kcal: Math.round(m.kcal), p: Math.round(m.p), c: Math.round(m.c), f: Math.round(m.f) }
}
/** Best recipe for a window: category match + per-serving kcal within ±20% of the slot budget;
 *  rank |Δkcal| → starred → |Δprotein|. No candidate → null. */
export function pickRecipe(category: SlotKey, budget: Macro4, recipes: Recipe[]): Recipe | null {
  const tol = RECIPE_FIT_TOLERANCE * budget.kcal
  const cands = recipes.filter(r => r.category === category && Math.abs(perServing(r).kcal - budget.kcal) <= tol)
  if (cands.length === 0) return null
  return cands.sort((a, z) => {
    const da = Math.abs(perServing(a).kcal - budget.kcal)
    const dz = Math.abs(perServing(z).kcal - budget.kcal)
    if (da !== dz) return da - dz
    if (a.starred !== z.starred) return a.starred ? -1 : 1
    return Math.abs(perServing(a).p - budget.p) - Math.abs(perServing(z).p - budget.p)
  })[0]
}

// ── protocol slot mapping ────────────────────────────────────────────────────
/** `StackDaySlot.zone` (from `projectStackDay`) → `FuelKind`. */
export const ZONE_FUEL_KIND: Record<StackZoneKey, FuelKind> = {
  wake: 'wake',
  breakfast: 'snack',
  pre_workout: 'preworkout',
  post_workout: 'snack',
  lunch: 'midday',
  dinner: 'evening',
  evening: 'evening',
  bedtime: 'evening',
}

/** Local wall-clock 'HH:mm' from a logged-at instant. Parsed via `new Date` so a UTC-serialized
 *  instant (real mode: `…T07:15:00Z`), an explicit offset (`…T09:15:00+02:00`) and an offset-less
 *  local mock string (`…T09:15:00`, which parses as local) all render the LOCAL wall-clock uniformly.
 *  Invalid date → the caller's fallback window/now time. */
function hhmmFromLoggedAt(iso: string, fallback: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return fallback
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── buildDayPlan ─────────────────────────────────────────────────────────────
export function buildDayPlan(input: DayPlanInput): FuelPlanToday {
  const { wake, bed, mealsPerDay, blocks, budget, meals, recipes, protocolSlots, nowHHmm } = input
  // Midnight-crossing axis (mezo-9rtw): steps 5-7 classify/sort on the SAME unwrapped wake→bed axis
  // `compileTemplate`/`dayZones` already use — a template (mezo-7102) can legitimately emit a
  // wall-clock time past midnight (e.g. a "Késői snack" at 01:00 on a wake-07:00/bed-03:00 day),
  // and comparing raw HH:mm minutes would misclassify/mis-sort it hours early. `unwrap` is the
  // identity function on a non-crossing day, so this is a no-op there (byte-identical output).
  const span = daySpan(wake, bed)
  const unwrap = (hhmm: string) => unwrapDayMinute(hhmm, span.wakeMin, span.crossesMidnight)
  const unwrappedNow = unwrap(nowHHmm)
  const kitchenCloseMin = span.bedMin - KITCHEN_CLOSE_OFFSET_MIN

  // 1. Windows + per-slot budgets. A template (mezo-7102) replaces the live placement/weight split
  //    with a replayed anchor plan + its explicit pct split; absent/null keeps today's behavior.
  const windows = input.template
    ? compileTemplate(input.template, { wake, bed, blocks })
    : placeWindows(wake, bed, mealsPerDay, blocks, input.weightKg ?? 0)
  const budgets = input.template ? splitBudgetPct(budget, windows) : splitBudget(budget, windows)

  // 2. Logged meals grouped by slotKey, each group sorted by loggedAt (multi-snack fills in time order).
  const loggedByKey: Record<SlotKey, FuelMeal[]> = { breakfast: [], lunch: [], dinner: [], snack: [] }
  for (const m of meals) {
    const k = mealSlotKey(m)
    if (k) loggedByKey[k].push(m)
  }
  for (const k of Object.keys(loggedByKey) as SlotKey[]) loggedByKey[k].sort((a, z) => a.loggedAt.localeCompare(z.loggedAt))
  const cursor: Record<SlotKey, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }

  // 3. Fill each window at its FIXED anchored time (mezo-1oy5 — the plan no longer re-flows around
  //    `now`): logged → done; else recipe suggestion; else budget-only.
  const mealSlots: FuelSlot[] = windows.map((w, i) => {
    const logged = loggedByKey[w.slotKey][cursor[w.slotKey]]
    if (logged) {
      cursor[w.slotKey]++
      return {
        time: hhmmFromLoggedAt(logged.loggedAt, toHHmm(w.time)),
        kind: w.kind,
        label: w.label,
        slotKey: w.slotKey,
        state: 'done',
        mealId: logged.id,
        mealName: mealDisplayName(logged),
        kcal: logged.kcal,
        p: logged.p,
        c: logged.c,
        f: logged.f,
      }
    }
    const b = budgets[i]
    const rec = pickRecipe(w.slotKey, b, recipes)
    if (rec) {
      const ps = roundMacro(perServing(rec))
      return {
        time: toHHmm(w.time),
        kind: w.kind,
        label: w.label,
        slotKey: w.slotKey,
        state: 'pending',
        mealName: rec.name,
        suggestedRecipeId: rec.id,
        kcal: ps.kcal,
        p: ps.p,
        c: ps.c,
        f: ps.f,
      }
    }
    return { time: toHHmm(w.time), kind: w.kind, label: w.label, slotKey: w.slotKey, state: 'pending', kcal: b.kcal, p: b.p, c: b.c, f: b.f }
  })

  // 3b. Surplus logged meals — anything of a slotKey beyond that slot's window count (a 2nd snack on
  //     a 4-meal day, ANY snack on a 3-meal day, a duplicate main) is NEVER dropped: it lands as an
  //     extra done slot at its own loggedAt time, labelled from a same-slot window or the meal title.
  const labelByKey: Partial<Record<SlotKey, string>> = {}
  for (const w of windows) if (!(w.slotKey in labelByKey)) labelByKey[w.slotKey] = w.label
  const extraSlots: FuelSlot[] = []
  for (const k of Object.keys(loggedByKey) as SlotKey[]) {
    for (let j = cursor[k]; j < loggedByKey[k].length; j++) {
      const m = loggedByKey[k][j]
      extraSlots.push({
        time: hhmmFromLoggedAt(m.loggedAt, nowHHmm),
        kind: k === 'snack' ? 'snack' : 'meal',
        label: labelByKey[k] ?? mealDisplayName(m) ?? m.title,
        slotKey: k,
        state: 'done',
        mealId: m.id,
        mealName: mealDisplayName(m),
        kcal: m.kcal,
        p: m.p,
        c: m.c,
        f: m.f,
      })
    }
  }

  // 4. Supplement (protocol) slots — item done-state arrives straight from `projectStackDay`'s
  //    per-occurrence `taken`; a rest-day-skipped entry is dropped from the slot, and a zone left
  //    with zero (all-skipped) entries never renders as an empty stack card.
  const protoSlots: FuelSlot[] = protocolSlots
    .map((s): FuelSlot => {
      const items: SlotItem[] = s.entries.filter(e => !e.skippedToday).map(e => ({
        type: 'supplement',
        refId: e.pantryItemId,
        label: e.dose ? `${e.name} · ${e.dose}` : e.name,
        done: e.taken,
      }))
      const done = items.length > 0 && items.every(it => it.done)
      return {
        time: s.time,
        kind: ZONE_FUEL_KIND[s.zone],
        label: `${s.label} stack`,
        state: done ? 'done' : 'pending',
        items,
        mezoNote: s.entries.find(e => e.reason)?.reason ?? undefined,
        windowTip: s.anchorNote ?? undefined,
      }
    })
    .filter(s => s.items!.length > 0)

  // 5. Training block slots — gym → workout, sport/run → sport; done once (start+duration) has passed.
  //    Evaluated on the unwrapped axis (mezo-9rtw) for consistency with steps 6/7: blocks come from
  //    real schedules and don't wrap today, so on a non-crossing day `unwrap` is the identity and
  //    this is byte-identical to the old raw comparison.
  const blockSlots: FuelSlot[] = blocks.map(b => {
    const start = unwrap(b.time)
    const end = start + (b.durationMin ?? DEFAULT_BLOCK_MIN)
    return {
      time: b.time,
      kind: b.kind === 'gym' ? 'workout' : 'sport',
      label: b.label,
      state: end <= unwrappedNow ? 'done' : 'pending',
      duration: b.durationMin ?? undefined,
    }
  })

  // 6. Fixed-plan state (mezo-1oy5): unlogged meal windows are missed (past) / now (current) /
  //    pending (future). nowWindow = the latest unlogged meal window at/before `now` while the day
  //    is still awake (before bedtime); if `now` precedes every meal, the earliest is "now". Once
  //    past bedtime the eating day is over → no "now", every unlogged window is "missed". (The gate
  //    is bedtime, NOT the 90-min kitchen-planning cutoff: the last window stays "now" until sleep.)
  //    Block slots (end ≤ now → done) and protocol slots keep their own state — no global now-flag.
  //    Classification runs on the unwrapped axis (mezo-9rtw) — see the header note above.
  const unlogged = mealSlots.map((_, i) => i).filter(i => mealSlots[i].state !== 'done')
  let nowWin = -1
  if (unwrappedNow <= span.bedMin && unlogged.length) {
    for (const i of unlogged) if (unwrap(mealSlots[i].time) <= unwrappedNow) nowWin = i
    if (nowWin === -1) nowWin = unlogged[0] // now precedes all meals → first is current
  }
  const nowTime = nowWin >= 0 ? unwrap(mealSlots[nowWin].time) : unwrappedNow
  for (const i of unlogged) {
    if (i === nowWin) mealSlots[i].state = 'now'
    else mealSlots[i].state = unwrap(mealSlots[i].time) < nowTime ? 'missed' : 'pending'
  }

  // 7. Merge + sort. Extra logged meals join the sort like any other slot (they are 'done'). Sorted
  //    on the unwrapped axis (mezo-9rtw) so a midnight-wrapped slot (e.g. a template's 01:00 "Késői
  //    snack" on a wake-07:00/bed-03:00 day) sorts LAST instead of first.
  const slots = [...mealSlots, ...extraSlots, ...protoSlots, ...blockSlots].sort((a, z) => unwrap(a.time) - unwrap(z.time))

  // 8. Top context fields.
  const gym = blocks.find(b => b.kind === 'gym')
  const sport = blocks.find(b => b.kind === 'sport')
  return {
    workout: gym
      ? {
          type: gym.label.split('·')[0].trim(),
          start: gym.time,
          end: gym.durationMin != null ? toHHmm(toMin(gym.time) + gym.durationMin) : '—',
          duration: gym.durationMin ?? 0,
        }
      : { type: '', start: '—', end: '—', duration: 0 },
    volleyball: sport
      ? { start: sport.time, end: sport.durationMin != null ? toHHmm(toMin(sport.time) + sport.durationMin) : '—', noneToday: false }
      : { start: '—', end: '—', noneToday: true },
    bedtime: bed,
    kitchenClose: toHHmm(((kitchenCloseMin % 1440) + 1440) % 1440),
    caffeineCutoff: input.caffeineCutoff,
    energy: budget.energy,
    slots,
  }
}
