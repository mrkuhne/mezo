import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MealInput } from '@/data/types'

// Single-hook override (the LogFlowPage.timestamp.test idiom): every hook stays real (mock mode),
// only logMeal becomes a spy so we can read the outgoing payload.
const hoisted = vi.hoisted(() => ({ logMeal: null as null | ((input: MealInput) => void) }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useMealActions: (date?: string) => ({
      ...actual.useMealActions(date),
      ...(hoisted.logMeal ? { logMeal: hoisted.logMeal } : {}),
    }),
  }
})

import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { useRecipes } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => { hoisted.logMeal = null; vi.unstubAllEnvs() })

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

function openFlowWithRecipe(recipeId?: string) {
  const { qc, wrapper } = setup()
  const recipes = renderHook(() => useRecipes(), { wrapper })
  const recipe = recipeId
    ? recipes.result.current.recipes.find(r => r.id === recipeId)!
    : recipes.result.current.recipes.find(r => r.ingredients.length >= 2)!
  render(
    <QueryClientProvider client={qc}>
      <LogFlowPage prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={vi.fn()} />
    </QueryClientProvider>,
  )
  return recipe
}

describe('LogFlowPage ingredient overrides', () => {
  it('keeps the ingredient list collapsed until asked', () => {
    const recipe = openFlowWithRecipe()
    expect(screen.queryByRole('button', { name: new RegExp(`${recipe.ingredients[0].name} növelés`, 'i') }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hozzávalók finomhangolása/i })).toBeInTheDocument()
  })

  it('expands to one editable row per ingredient', () => {
    const recipe = openFlowWithRecipe()
    fireEvent.click(screen.getByRole('button', { name: /hozzávalók finomhangolása/i }))
    for (const line of recipe.ingredients) {
      expect(screen.getByRole('button', { name: new RegExp(`${line.name} növelés`, 'i') })).toBeInTheDocument()
    }
  })

  it('sends the changed line as an ingredientOverride and leaves the rest alone', () => {
    const logSpy = vi.fn()
    hoisted.logMeal = logSpy as (input: MealInput) => void
    const recipe = openFlowWithRecipe()

    fireEvent.click(screen.getByRole('button', { name: /hozzávalók finomhangolása/i }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${recipe.ingredients[1].name} csökkentés`, 'i') }))
    fireEvent.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))

    const payload = logSpy.mock.calls[0][0] as MealInput
    const item = payload.items[0]
    expect(item.source).toBe('recipe')
    if (item.source === 'estimate') throw new Error('expected the recipe arm')
    expect(item.ingredientOverrides).toHaveLength(1)
    expect(item.ingredientOverrides![0].lineOrder).toBe(1)
    expect(item.ingredientOverrides![0].pantryItemId).toBe(recipe.ingredients[1].refId)
    expect(item.ingredientOverrides![0].amount).toBeLessThan(recipe.ingredients[1].amount)
  })

  it('sends no overrides when nothing was touched', () => {
    const logSpy = vi.fn()
    hoisted.logMeal = logSpy as (input: MealInput) => void
    openFlowWithRecipe()

    fireEvent.click(screen.getByRole('button', { name: /hozzávalók finomhangolása/i }))
    fireEvent.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))

    const item = (logSpy.mock.calls[0][0] as MealInput).items[0]
    if (item.source === 'estimate') throw new Error('expected the recipe arm')
    expect(item.ingredientOverrides).toBeUndefined()
  })

  it('drops the override entirely when a row is stepped back to its original amount', () => {
    const logSpy = vi.fn()
    hoisted.logMeal = logSpy as (input: MealInput) => void
    const recipe = openFlowWithRecipe()

    fireEvent.click(screen.getByRole('button', { name: /hozzávalók finomhangolása/i }))
    const name = recipe.ingredients[0].name
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${name} csökkentés`, 'i') }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${name} növelés`, 'i') }))

    // the header must not claim a modification, and Alaphelyzet must be gone
    expect(screen.queryByText(/módosítva/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /alaphelyzet/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))
    const item = (logSpy.mock.calls[0][0] as MealInput).items[0]
    if (item.source === 'estimate') throw new Error('expected the recipe arm')
    expect(item.ingredientOverrides).toBeUndefined()
  })

  it('reverts every change with Alaphelyzet', () => {
    const logSpy = vi.fn()
    hoisted.logMeal = logSpy as (input: MealInput) => void
    const recipe = openFlowWithRecipe()

    fireEvent.click(screen.getByRole('button', { name: /hozzávalók finomhangolása/i }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${recipe.ingredients[0].name} csökkentés`, 'i') }))
    fireEvent.click(screen.getByRole('button', { name: /alaphelyzet/i }))
    fireEvent.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))

    const item = (logSpy.mock.calls[0][0] as MealInput).items[0]
    if (item.source === 'estimate') throw new Error('expected the recipe arm')
    expect(item.ingredientOverrides).toBeUndefined()
  })

  // mezo-m6uv — the nutrient rows (Telített/Cukor/Rost/Só) follow the SAME override rule as the
  // macro rows above. 'rec-1' (Túrós zabkása) is 1 servings, prefilled at 1 adag, so the per-line
  // and "EZ AZ ÉTKEZÉS" total nutrients are identical — both cells carry the expected value.
  // Rost (fiber) before: 10.6*0.7 (zab) + 0 (túró) + 2.4*0.8 (áfonya) + 0 (méz) + 12.5*0.15 (mandula)
  // = 7.42 + 0 + 1.92 + 0 + 1.875 = 11.215 g -> rounds to "11,2" (derived from the mock seed in
  // frontend/src/data/fuel/pantry.ts, verified against recipeMacros' own roundGram/formatGram).
  // Stepping the zab line's amount down by one step (70g -> 60g, step=10 for 'g') drops its fiber
  // contribution to 10.6*0.6 = 6.36g, so the new total is 6.36 + 0 + 1.92 + 0 + 1.875 = 10.155 g,
  // which rounds to "10,2".
  it('a Rost-összesítő 11,2-ről 10,2-re csökken, amikor a zab-sor mennyiségét egy lépéssel visszaveszik', () => {
    const recipe = openFlowWithRecipe('rec-1')
    expect(recipe.ingredients[0].refId).toBe('ing-zab')

    expect(screen.getAllByText('11,2')).toHaveLength(2) // soronkénti + "EZ AZ ÉTKEZÉS" cella

    fireEvent.click(screen.getByRole('button', { name: /hozzávalók finomhangolása/i }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${recipe.ingredients[0].name} csökkentés`, 'i') }))

    expect(screen.queryAllByText('11,2')).toHaveLength(0)
    expect(screen.getAllByText('10,2')).toHaveLength(2)
  })
})
