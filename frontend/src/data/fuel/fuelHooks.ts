import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { mealApi, type FuelDayData } from '@/data/fuel/mealApi'
import { apiFetch } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { localDateString } from '@/shared/lib/dates'
import { useDualQuery } from '@/data/useDualQuery'
import { fuelDay } from '@/data/fuel/fuel'
import { ingredients, recipes as mockRecipes, MOCK_AI_MEAL_DRAFT } from '@/data/fuel/pantry'
import type { MealInput, MealItemLine, FuelMeal, FuelDay, MacroSet, RecipeLog, MealAiDraft } from '@/data/types'

const FUELDAY_KEY = 'fuelDay'
const RECIPES_KEY = ['recipes'] as const
const PANTRY_KEY = ['pantry'] as const

const fuelDayKey = (date: string) => [FUELDAY_KEY, date] as const

/** The query-driven slice (real or mock seed); the rest of FuelDay is composed in from statics. */
const seedDayData: FuelDayData = {
  date: localDateString(),
  targets: fuelDay.targets,
  consumed: fuelDay.consumed,
  meals: fuelDay.meals,
}
// Real-mode unresolved fallback — a ZERO day, NEVER the seed's fabricated macros + meals
// (the "no static fallback in real mode" invariant). `date` is never read by consumers
// (FuelDay drops it); targets/consumed zeroed, meals empty.
const ZERO_MACROS: MacroSet = { kcal: 0, p: 0, c: 0, f: 0, water: 0 }
const FUELDAY_EMPTY: FuelDayData = { date: '', targets: ZERO_MACROS, consumed: ZERO_MACROS, meals: [] }

/**
 * Composed dual-mode. Only targets/consumed/meals are query-driven (real: mealApi.getDay,
 * mock: the static seed via initialData); pacing/micronutrients/supplements stay static so the
 * public return keeps the full FuelDay shape verbatim. Mock cache is client-owned (useMealActions
 * mutates via setQueryData) → never background-refetch in mock.
 */
export function useFuelDay(date: string = localDateString()): { fuel: FuelDay } {
  const { data } = useDualQuery({
    queryKey: fuelDayKey(date),
    mockData: seedDayData,
    realFetch: () => mealApi.getDay(date),
    realEmpty: FUELDAY_EMPTY,
    realStaleTime: 0,
  })
  const fuel: FuelDay = {
    targets: data.targets,
    consumed: data.consumed,
    meals: data.meals,
    pacing: fuelDay.pacing,
    micronutrients: fuelDay.micronutrients,
    supplements: fuelDay.supplements,
  }
  return { fuel }
}

/** log/update/delete on the ['fuelDay', date] cache. Real writes invalidate fuelDay + recipes +
 *  pantry (logging shifts recipe recentLogs + pantry usage). */
export function useMealActions(date: string = localDateString()) {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [FUELDAY_KEY] })
    qc.invalidateQueries({ queryKey: RECIPES_KEY })
    qc.invalidateQueries({ queryKey: PANTRY_KEY })
  }

  const logM = useMutation({
    mutationFn: mock
      ? async (input: MealInput) => {
          mockLog(qc, date, input)
          awardGamificationEvent(qc, { type: 'MEAL' })
        }
      : (input: MealInput) => mealApi.create(input),
    onSuccess: mock ? undefined : invalidate,
  })
  const updateM = useMutation({
    mutationFn: mock
      ? async (v: { id: string; input: MealInput }) => mockUpdate(qc, date, v.id, v.input)
      : (v: { id: string; input: MealInput }) => mealApi.update(v.id, v.input),
    onSuccess: mock ? undefined : invalidate,
  })
  const deleteM = useMutation({
    mutationFn: mock
      ? async (id: string) => mockDelete(qc, date, id)
      : (id: string) => mealApi.remove(id),
    onSuccess: mock ? undefined : invalidate,
  })

  // AI meal draft (mezo-78rn) — an ephemeral read (no cache), like pantry's scrapeItem; mock mode
  // serves the canned draft after a demo delay, real mode POSTs multipart to /api/meal/ai-draft.
  const draftMealFromAi = useCallback(
    (req: { date: string; text?: string; photo?: Blob }): Promise<MealAiDraft> =>
      mock
        ? new Promise(resolve => setTimeout(() => resolve(MOCK_AI_MEAL_DRAFT), 600))
        : mealApi.aiDraft(req),
    [mock],
  )

  const logMeal = useCallback((input: MealInput) => logM.mutate(input), [logM])
  const updateMeal = useCallback((id: string, input: MealInput) => updateM.mutate({ id, input }), [updateM])
  const deleteMeal = useCallback((id: string) => deleteM.mutate(id), [deleteM])
  return { logMeal, updateMeal, deleteMeal, draftMealFromAi }
}

/** Water intake write on the ['fuelDay', date] cache. Mock increments consumed.water in place;
 *  real POSTs /api/water-log and invalidates fuelDay so the rollup re-reads server-side. */
export function useWaterActions(date: string = localDateString()) {
  const qc = useQueryClient()
  const mock = isMockMode()

  const waterM = useMutation({
    mutationFn: mock
      ? async (amountMl: number) => {
          qc.setQueryData<FuelDayData>(fuelDayKey(date), d => {
            const base = d ?? { ...seedDayData, date }
            return { ...base, consumed: { ...base.consumed, water: base.consumed.water + amountMl } }
          })
        }
      : (amountMl: number) => mealApi.logWater(date, amountMl),
    onSuccess: mock
      ? undefined
      : () => {
          qc.invalidateQueries({ queryKey: [FUELDAY_KEY] })
          // Quest evaluation is read-triggered: nudge the day's quest read so a met
          // water_target flips to completed without leaving the current screen.
          qc.invalidateQueries({ queryKey: ['dailyQuests', date] })
        },
  })

  const logWater = useCallback((amountMl: number) => waterM.mutate(amountMl), [waterM])
  return { logWater }
}

const RECIPE_LOGS_KEY = (id: string) => ['recipeLogs', id] as const

/** Per-recipe logs feeding RecipeLogsList. Mock derives from the recipe seed's recentLogs; real
 *  queries GET /api/recipe/{id}/logs — since mezo-yta each log carries the meal's real score
 *  (null for pre-scoring rows → 0 → the component's pending sparkle); the baseline delta is
 *  view-side (RecipeLogsList computes it from the recipe's mezoFit baseline). */
export function useRecipeLogs(recipeId: string): { logs: RecipeLog[] } {
  const mock = isMockMode()
  const seed = () => mockRecipes.find(r => r.id === recipeId)?.recentLogs ?? []
  const { data } = useQuery({
    queryKey: RECIPE_LOGS_KEY(recipeId),
    queryFn: mock
      ? async () => seed()
      : async () => {
          const res = await apiFetch<{ recentLogs: (Omit<RecipeLog, 'score' | 'delta'> & { score?: number | null })[] }>(`/api/recipe/${recipeId}/logs`)
          return res.recentLogs.map(l => ({ ...l, score: l.score ?? 0, delta: 0 }))
        },
    initialData: mock ? seed() : undefined,
    staleTime: mock ? Infinity : 0,
  })
  return { logs: data ?? [] }
}

// --- mock-mode cache mutators. Contribution uses the SAME whole-number amount/per formula as the
// backend mapper: factor = amount / per (per>=1); contribution.X = Math.round(snapshot.X × factor). ---
const SLOT_LABEL: Record<MealInput['slot'], string> = {
  breakfast: 'Reggeli', lunch: 'Ebéd', dinner: 'Vacsora', snack: 'Snack',
}

/** Resolve a request item to a snapshot (name/per/macros/nova) from the mock seeds, then scale.
 *  An estimate line carries its own snapshot (no seed lookup) — same round(macro/per × amount) rule. */
function buildLine(item: MealInput['items'][number]): MealItemLine {
  if (item.source === 'estimate') {
    const per = Math.max(1, item.per)
    return {
      source: 'estimate', refId: '', amount: item.amount, unit: item.unit,
      name: item.name,
      contribution: {
        kcal: Math.round((item.kcal / per) * item.amount),
        p: Math.round((item.proteinG / per) * item.amount),
        c: Math.round((item.carbsG / per) * item.amount),
        f: Math.round((item.fatG / per) * item.amount),
      },
      nova: item.nova ?? undefined,
    }
  }
  if (item.source === 'recipe') {
    const r = mockRecipes.find(x => x.id === item.refId)
    const per = Math.max(1, r?.servings ?? 1)
    const m = r?.macros ?? { kcal: 0, p: 0, c: 0, f: 0 }
    return {
      source: 'recipe', refId: item.refId, amount: item.amount, unit: item.unit,
      name: r?.name ?? 'Recept',
      contribution: {
        kcal: Math.round((m.kcal / per) * item.amount),
        p: Math.round((m.p / per) * item.amount),
        c: Math.round((m.c / per) * item.amount),
        f: Math.round((m.f / per) * item.amount),
      },
      nova: r?.novaDominant,
    }
  }
  const ing = ingredients.find(x => x.id === item.refId)
  const per = Math.max(1, ing?.per ?? 100)
  const m = ing?.macros ?? { kcal: 0, p: 0, c: 0, f: 0 }
  return {
    source: 'pantry', refId: item.refId, amount: item.amount, unit: item.unit,
    name: ing?.name ?? 'Kamra',
    contribution: {
      kcal: Math.round((m.kcal / per) * item.amount),
      p: Math.round((m.p / per) * item.amount),
      c: Math.round((m.c / per) * item.amount),
      f: Math.round((m.f / per) * item.amount),
    },
    nova: ing?.nova,
  }
}

function sumMacros(lines: MealItemLine[]) {
  return lines.reduce(
    (a, l) => ({ kcal: a.kcal + l.contribution.kcal, p: a.p + l.contribution.p, c: a.c + l.contribution.c, f: a.f + l.contribution.f }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  )
}

function buildMeal(id: string, date: string, input: MealInput): FuelMeal {
  const lines = input.items.map(buildLine)
  const macros = sumMacros(lines)
  return {
    id, slot: SLOT_LABEL[input.slot], title: input.title ?? lines[0]?.name ?? 'Étkezés',
    score: null, kcal: macros.kcal, p: macros.p, c: macros.c, f: macros.f,
    mealItems: lines, items: lines.map(l => `${l.name} ${l.amount}${l.unit}`), tags: [],
    loggedAt: input.loggedAt ?? `${date}T${new Date().toTimeString().slice(0, 8)}`, mealDate: date,
  }
}

function recomputeConsumed(meals: FuelMeal[], water: number): MacroSet {
  return meals.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f, water: a.water }),
    { kcal: 0, p: 0, c: 0, f: 0, water },
  )
}

function patchDay(qc: ReturnType<typeof useQueryClient>, date: string, fn: (d: FuelDayData) => FuelMeal[]) {
  qc.setQueryData<FuelDayData>(fuelDayKey(date), prev => {
    const base = prev ?? seedDayData
    const meals = fn(base)
    return { ...base, meals, consumed: recomputeConsumed(meals, base.consumed.water) }
  })
  return undefined
}
function mockLog(qc: ReturnType<typeof useQueryClient>, date: string, input: MealInput) {
  return patchDay(qc, date, d => [...d.meals, buildMeal(crypto.randomUUID(), date, input)])
}
function mockUpdate(qc: ReturnType<typeof useQueryClient>, date: string, id: string, input: MealInput) {
  return patchDay(qc, date, d => d.meals.map(m => (m.id === id ? buildMeal(id, date, input) : m)))
}
function mockDelete(qc: ReturnType<typeof useQueryClient>, date: string, id: string) {
  return patchDay(qc, date, d => d.meals.filter(m => m.id !== id))
}
