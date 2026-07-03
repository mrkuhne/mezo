// Fuel P5 — deterministic day-planner core.
//
// Pure logic: given the user's wake/bed rhythm, the day's REAL training blocks, a daily
// kcal/macro budget, the day's logged meals, a recipe catalog, the supplement protocol and
// the day's intakes, it composes a `FuelPlanToday` (meal windows around the workouts, per-slot
// budgets, recipe suggestions, supplement + block slots, now-flag). No ambient time (no Date.now /
// `new Date()` / random): `nowHHmm` is injected; logged-at strings are parsed deterministically via
// `new Date(iso)`. Design: docs/superpowers/specs/2026-07-02-fuel-p5-merged-timeline-design.md §3.

import {
  CAFFEINE_CUTOFF,
  DEFAULT_BLOCK_MIN,
  EATING_START_OFFSET_MIN,
  FAT_KCAL_SHARE,
  KITCHEN_CLOSE_OFFSET_MIN,
  MIN_SLOT_GAP_MIN,
  POST_WORKOUT_SNAP_MIN,
  PRE_WORKOUT_SNAP_MIN,
  RECIPE_FIT_TOLERANCE,
  SLOT_WEIGHT,
  toHHmm,
  toMin,
} from '@/data/fuel/fuelConfig'
import type { Intake } from '@/data/fuel/fuelApi'
import type {
  FuelKind,
  FuelMeal,
  FuelPlanToday,
  FuelSlot,
  MacroSet,
  ProtocolSlotData,
  Recipe,
  SlotItem,
} from '@/data/types'

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
  budget: Macro4
  meals: FuelMeal[]
  recipes: Recipe[]
  protocolSlots: ProtocolSlotData[]
  intakes: Intake[]
  nowHHmm: string
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

// ── deriveDailyBudget ────────────────────────────────────────────────────────
// From the active Goal prescription segment (kcal + proteinG) derive carbs/fat with the fixed
// split (fat = 27.5% of kcal ÷ 9, carbs = remainder ÷ 4). No segment → the config fallback passes
// through (water is dropped — the planner budget carries no water field).
export function deriveDailyBudget(
  segment: { kcal: number; proteinG: number } | null,
  fallback: MacroSet,
): Macro4 {
  if (!segment) return { kcal: fallback.kcal, p: fallback.p, c: fallback.c, f: fallback.f }
  const { kcal, proteinG: p } = segment
  const f = Math.round((kcal * FAT_KCAL_SHARE) / 9)
  const c = Math.round((kcal - p * 4 - f * 9) / 4)
  return { kcal, p, c, f }
}

// ── placeWindows ─────────────────────────────────────────────────────────────
// Spread the mealsPerDay structure across the eating span (wake+45 → kitchenClose = bed−90):
// mains Reggeli/Ebéd/Vacsora at span fractions 0/0.5/1; snacks between. Then training snaps
// (nearest earlier window → block−75; nearest main to the block → blockEnd+45, weight 2.5),
// clamp into [eatingStart, kitchenClose], and forward-push to keep MIN_SLOT_GAP_MIN spacing.
export function placeWindows(
  wake: string,
  bed: string,
  mealsPerDay: number,
  blocks: PlannerBlock[],
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

  // Training snaps — process blocks in time order.
  for (const b of [...blocks].sort((x, y) => toMin(x.time) - toMin(y.time))) {
    const start = toMin(b.time)
    const end = start + (b.durationMin ?? DEFAULT_BLOCK_MIN)
    // Post-workout main = the main meal nearest the block; snaps to blockEnd+45, weighted 2.5.
    const post = windows
      .filter(w => w.kind === 'meal')
      .sort((a, z) => Math.abs(a.time - start) - Math.abs(z.time - start))[0]
    if (post) {
      post.time = clamp(end + POST_WORKOUT_SNAP_MIN)
      post.weight = SLOT_WEIGHT.postWorkoutMain
    }
    // Pre-fuel = nearest window strictly before the block (excluding the post-workout main).
    const pre = windows.filter(w => w !== post && w.time < start).sort((a, z) => z.time - a.time)[0]
    if (pre) pre.time = clamp(start - PRE_WORKOUT_SNAP_MIN)
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

// ── recipe fit ───────────────────────────────────────────────────────────────
function perServing(r: Recipe): Macro4 {
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
/** `ProtocolSlotData.kind` (from buildProtocol) → `FuelKind`. */
export const PROTOCOL_KIND: Record<string, FuelKind> = {
  morning: 'wake',
  'pre-fuel': 'snack',
  'pre-workout': 'preworkout',
  'fat-bound': 'midday',
  evening: 'evening',
}
const PROTOCOL_LABEL: Partial<Record<FuelKind, string>> = {
  wake: 'Ébresztő',
  snack: 'Pre-workout snack',
  preworkout: 'Pre-workout stack',
  midday: 'Délutáni stack',
  evening: 'Esti stack',
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
  const { wake, bed, mealsPerDay, blocks, budget, meals, recipes, protocolSlots, intakes, nowHHmm } = input
  const now = toMin(nowHHmm)
  const kitchenCloseMin = toMin(bed) - KITCHEN_CLOSE_OFFSET_MIN
  const intakeRefs = new Set(intakes.map(i => i.pantryItemId))

  // 1. Windows + per-slot budgets.
  const windows = placeWindows(wake, bed, mealsPerDay, blocks)
  const budgets = splitBudget(budget, windows)

  // 2. Logged meals grouped by slotKey, each group sorted by loggedAt (multi-snack fills in time order).
  const loggedByKey: Record<SlotKey, FuelMeal[]> = { breakfast: [], lunch: [], dinner: [], snack: [] }
  for (const m of meals) {
    const k = mealSlotKey(m)
    if (k) loggedByKey[k].push(m)
  }
  for (const k of Object.keys(loggedByKey) as SlotKey[]) loggedByKey[k].sort((a, z) => a.loggedAt.localeCompare(z.loggedAt))
  const cursor: Record<SlotKey, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }

  // 3. Fill each window: logged → done; else recipe suggestion; else budget-only.
  const mealSlots: FuelSlot[] = windows.map((w, i) => {
    const logged = loggedByKey[w.slotKey][cursor[w.slotKey]]
    if (logged) {
      cursor[w.slotKey]++
      return {
        time: hhmmFromLoggedAt(logged.loggedAt, toHHmm(w.time)),
        kind: w.kind,
        label: w.label,
        state: 'done',
        mealId: logged.id,
        mealName: logged.title,
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
        state: 'pending',
        mealName: rec.name,
        suggestedRecipeId: rec.id,
        kcal: ps.kcal,
        p: ps.p,
        c: ps.c,
        f: ps.f,
      }
    }
    return { time: toHHmm(w.time), kind: w.kind, label: w.label, state: 'pending', kcal: b.kcal, p: b.p, c: b.c, f: b.f }
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
        label: labelByKey[k] ?? m.title,
        state: 'done',
        mealId: m.id,
        mealName: m.title,
        kcal: m.kcal,
        p: m.p,
        c: m.c,
        f: m.f,
      })
    }
  }

  // 4. Supplement (protocol) slots — item pips done via intakes; slot done when every item taken.
  const protoSlots: FuelSlot[] = protocolSlots.map(p => {
    const kind = PROTOCOL_KIND[p.kind] ?? 'midday'
    const items: SlotItem[] = p.items.map(it => ({
      type: 'supplement',
      refId: it.refId,
      label: it.dose ? `${it.name} · ${it.dose}` : it.name,
      done: intakeRefs.has(it.refId),
      primary: p.primary || undefined,
    }))
    const done = items.length > 0 && items.every(it => it.done)
    return {
      time: p.time,
      kind,
      label: PROTOCOL_LABEL[kind] ?? p.window,
      state: done ? 'done' : 'pending',
      items,
      mezoNote: p.reasoning,
      windowTip: p.relatedTo,
    }
  })

  // 5. Training block slots — gym → workout, sport/run → sport; done once (start+duration) has passed.
  const blockSlots: FuelSlot[] = blocks.map(b => {
    const end = toMin(b.time) + (b.durationMin ?? DEFAULT_BLOCK_MIN)
    return {
      time: b.time,
      kind: b.kind === 'gym' ? 'workout' : 'sport',
      label: b.label,
      state: end <= now ? 'done' : 'pending',
      duration: b.durationMin ?? undefined,
    }
  })

  // 6. Merge + sort + now-flag (LAST non-done slot at or before now). Extra logged meals join the
  //     sort/now-flag like any other slot (they are 'done', so they never receive the now-flag).
  const slots = [...mealSlots, ...extraSlots, ...protoSlots, ...blockSlots].sort((a, z) => toMin(a.time) - toMin(z.time))
  let nowIdx = -1
  for (let i = 0; i < slots.length; i++) {
    if (toMin(slots[i].time) <= now && slots[i].state !== 'done') nowIdx = i
  }
  if (nowIdx >= 0) slots[nowIdx].state = 'now'

  // 7. Top context fields.
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
    kitchenClose: toHHmm(kitchenCloseMin),
    caffeineCutoff: CAFFEINE_CUTOFF,
    slots,
  }
}
