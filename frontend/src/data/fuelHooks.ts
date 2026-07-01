import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { mealApi, type FuelDayData } from '@/lib/mealApi'
import { apiFetch } from '@/lib/api'
import { isMockMode } from '@/lib/mode'
import { localDateString } from '@/lib/dates'
import { useDualQuery } from '@/data/useDualQuery'
import { fuelDay } from '@/data/fuel'
import { ingredients, recipes as mockRecipes } from '@/data/pantry'
import type { MealInput, MealItemLine, FuelMeal, FuelDay, MacroSet, RecipeLog } from '@/data/types'

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
      ? async (input: MealInput) => mockLog(qc, date, input)
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

  const logMeal = useCallback((input: MealInput) => logM.mutate(input), [logM])
  const updateMeal = useCallback((id: string, input: MealInput) => updateM.mutate({ id, input }), [updateM])
  const deleteMeal = useCallback((id: string) => deleteM.mutate(id), [deleteM])
  return { logMeal, updateMeal, deleteMeal }
}

const RECIPE_LOGS_KEY = (id: string) => ['recipeLogs', id] as const

/** Per-recipe logs feeding RecipeLogsList. Mock derives from the recipe seed's recentLogs; real
 *  queries GET /api/recipe/{id}/logs and fills a neutral score/delta (v1 logs are score-less). */
export function useRecipeLogs(recipeId: string): { logs: RecipeLog[] } {
  const mock = isMockMode()
  const seed = () => mockRecipes.find(r => r.id === recipeId)?.recentLogs ?? []
  const { data } = useQuery({
    queryKey: RECIPE_LOGS_KEY(recipeId),
    queryFn: mock
      ? async () => seed()
      : async () => {
          const res = await apiFetch<{ recentLogs: Omit<RecipeLog, 'score' | 'delta'>[] }>(`/api/recipe/${recipeId}/logs`)
          return res.recentLogs.map(l => ({ ...l, score: 0, delta: 0 }))
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

/** Resolve a request item to a snapshot (name/per/macros/nova) from the mock seeds, then scale. */
function buildLine(item: MealInput['items'][number]): MealItemLine {
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

function recomputeConsumed(meals: FuelMeal[], targets: MacroSet): MacroSet {
  return meals.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f, water: a.water }),
    { kcal: 0, p: 0, c: 0, f: 0, water: targets.water },
  )
}

function patchDay(qc: ReturnType<typeof useQueryClient>, date: string, fn: (d: FuelDayData) => FuelMeal[]) {
  qc.setQueryData<FuelDayData>(fuelDayKey(date), prev => {
    const base = prev ?? seedDayData
    const meals = fn(base)
    return { ...base, meals, consumed: recomputeConsumed(meals, base.targets) }
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
