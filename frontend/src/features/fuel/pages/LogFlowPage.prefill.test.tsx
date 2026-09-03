// Mezo · LogFlowPage prefill/slot/name contracts — retargeted verbatim from the retired
// LogMealSheet.test.tsx (mezo-d20.9.1): every entry point below (recipe prefill, pantry prefill,
// initialSlot seeding, the derived-until-touched title) is behaviour LogFlowPage now owns.
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { useFuelDay, useRecipes, usePantry } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

describe('LogFlowPage', () => {
  it('opens pre-filled from a recipe and logs it to the day (meal appended)', async () => {
    const { qc, wrapper } = setup()
    const recipes = renderHook(() => useRecipes(), { wrapper })
    const recipe = recipes.result.current.recipes[0]
    const day = renderHook(() => useFuelDay(), { wrapper })
    const before = day.result.current.fuel.meals.length

    const onClose = vi.fn()
    render(
      <QueryClientProvider client={qc}>
        <LogFlowPage prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={onClose} />
      </QueryClientProvider>,
    )

    // the recipe name shows as a pre-filled item line (and as the derived totals title)
    expect(screen.getAllByText(recipe.name).length).toBeGreaterThanOrEqual(1)
    fireEvent.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))

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
        <LogFlowPage prefill={{ source: 'pantry', pantryItemId: ing.id }} onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(screen.getAllByText(ing.name).length).toBeGreaterThanOrEqual(1)
    fireEvent.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))
    await waitFor(() => expect(day.result.current.fuel.meals.length).toBe(before + 1))
  })

  // Since mezo-byo1 the per-line macro strip is the kind-wash mini-cell row (no MacroCells rail);
  // the NutrientCells row keeps its own perLabel rail as the single basis marker on the card.
  it('renders the per-line NutrientCells rail with the line basis', () => {
    const { qc, wrapper } = setup()
    const pantry = renderHook(() => usePantry(), { wrapper })
    // ing-csirkemell (fixture index 0) carries non-null nutrient facts, so NutrientCells renders
    // instead of being hidden by its all-null-hide default.
    const ing = pantry.result.current.ingredients[0]

    render(
      <QueryClientProvider client={qc}>
        <LogFlowPage prefill={{ source: 'pantry', pantryItemId: ing.id }} onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    const perLabel = `${ing.per} ${ing.unit}`
    // The single rail comes from NutrientCells now.
    expect(screen.getAllByText(perLabel)).toHaveLength(1)
  })

  it('changing the slot segmented control updates the logged meal slot', async () => {
    const { qc, wrapper } = setup()
    const pantry = renderHook(() => usePantry(), { wrapper })
    const ing = pantry.result.current.ingredients[0]
    const day = renderHook(() => useFuelDay(), { wrapper })

    render(
      <QueryClientProvider client={qc}>
        <LogFlowPage prefill={{ source: 'pantry', pantryItemId: ing.id }} onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Vacsora' }))
    fireEvent.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))
    // The flow sends the 'dinner' enum in MealInput.slot; the (shipped, frozen) data
    // layer stores FuelMeal.slot as its Hungarian display label ('Vacsora') — so that
    // is what surfaces on the logged meal.
    await waitFor(() => {
      expect(day.result.current.fuel.meals.some(m => m.slot === 'Vacsora')).toBe(true)
    })
  })

  it('seeds the slot segmented control from initialSlot', () => {
    const { qc } = setup()
    render(
      <QueryClientProvider client={qc}>
        <LogFlowPage initialSlot="dinner" onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    // The 'Vacsora' (dinner) segment is pre-selected without any user interaction.
    expect(screen.getByRole('button', { name: 'Vacsora' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Reggeli' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('disables save when there are no items', () => {
    const { qc } = setup()
    render(
      <QueryClientProvider client={qc}>
        <LogFlowPage onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(screen.getByRole('button', { name: /logolás · \+10 XP/i })).toBeDisabled()
  })

  // Derived-only meal name (mezo-byo1 — the NÉV field is gone): the title is always
  // deriveMealName(lines). The file has no `useMealActions` mock; instead we assert through the
  // real mock-mode data layer, where buildMeal persists `title: input.title ?? …`, so the
  // appended meal's title proves what the composer sent.
  it('derives the meal title from the prefilled lines and sends it on save', async () => {
    const { qc, wrapper } = setup()
    const recipes = renderHook(() => useRecipes(), { wrapper })
    const recipe = recipes.result.current.recipes[0]
    const day = renderHook(() => useFuelDay(), { wrapper })
    const before = day.result.current.fuel.meals.length

    render(
      <QueryClientProvider client={qc}>
        <LogFlowPage prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={vi.fn()} />
      </QueryClientProvider>,
    )

    // No editable name field any more — the derived name lives on the totals card.
    expect(screen.queryByLabelText('Étkezés neve')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))

    await waitFor(() => expect(day.result.current.fuel.meals.length).toBe(before + 1))
    expect(day.result.current.fuel.meals.at(-1)?.title).toBe(recipe.name)
  })
})
