import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { RecipeCard } from './RecipeCard'
import { useRecipes } from '@/data/hooks'
import { QueryWrapper } from '@/test/queryWrapper'

// RecipeCard reads usePantry (ingredient names) — a dual-mode TanStack query since Task 7.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the recipe name, macros and Mezo fit; click opens', async () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const recipe = result.current.recipes[0]
  const onOpen = vi.fn()
  render(<RecipeCard recipe={recipe} onOpen={onOpen} />, { wrapper: QueryWrapper })
  expect(screen.getByText(recipe.name)).toBeInTheDocument()
  expect(screen.getByText(/Mezo fit/)).toBeInTheDocument()
  await userEvent.click(screen.getByText(recipe.name))
  expect(onOpen).toHaveBeenCalledWith(recipe)
})
