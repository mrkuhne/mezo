import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { useFuelDay, useRecipes, usePantry } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

describe('LogMealSheet', () => {
  it('opens pre-filled from a recipe and logs it to the day (meal appended)', async () => {
    const { qc, wrapper } = setup()
    const recipes = renderHook(() => useRecipes(), { wrapper })
    const recipe = recipes.result.current.recipes[0]
    const day = renderHook(() => useFuelDay(), { wrapper })
    const before = day.result.current.fuel.meals.length

    const onClose = vi.fn()
    render(
      <QueryClientProvider client={qc}>
        <LogMealSheet prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={onClose} />
      </QueryClientProvider>,
    )

    // the recipe name shows as a pre-filled item line
    expect(screen.getByText(recipe.name)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /logolás a mai naphoz/i }))

    await waitFor(() => {
      expect(day.result.current.fuel.meals.length).toBe(before + 1)
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('opens pre-filled from a pantry item and logs it', async () => {
    const { qc, wrapper } = setup()
    const pantry = renderHook(() => usePantry(), { wrapper })
    const ing = pantry.result.current.ingredients[0]
    const day = renderHook(() => useFuelDay(), { wrapper })
    const before = day.result.current.fuel.meals.length

    render(
      <QueryClientProvider client={qc}>
        <LogMealSheet prefill={{ source: 'pantry', pantryItemId: ing.id }} onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(screen.getByText(ing.name)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /logolás a mai naphoz/i }))
    await waitFor(() => expect(day.result.current.fuel.meals.length).toBe(before + 1))
  })

  it('changing the slot segmented control updates the logged meal slot', async () => {
    const { qc, wrapper } = setup()
    const pantry = renderHook(() => usePantry(), { wrapper })
    const ing = pantry.result.current.ingredients[0]
    const day = renderHook(() => useFuelDay(), { wrapper })

    render(
      <QueryClientProvider client={qc}>
        <LogMealSheet prefill={{ source: 'pantry', pantryItemId: ing.id }} onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Vacsora' }))
    fireEvent.click(screen.getByRole('button', { name: /logolás a mai naphoz/i }))
    // The sheet sends the 'dinner' enum in MealInput.slot; the (shipped, frozen) data
    // layer stores FuelMeal.slot as its Hungarian display label ('Vacsora') — so that
    // is what surfaces on the logged meal.
    await waitFor(() => {
      expect(day.result.current.fuel.meals.some(m => m.slot === 'Vacsora')).toBe(true)
    })
  })

  it('disables save when there are no items', () => {
    const { qc } = setup()
    render(
      <QueryClientProvider client={qc}>
        <LogMealSheet onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(screen.getByRole('button', { name: /logolás a mai naphoz/i })).toBeDisabled()
  })
})
