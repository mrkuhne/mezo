import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { RecipeCard } from './RecipeCard'
import { useRecipes } from '@/data/hooks'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the editorial name, macro cells and pending fit; click opens', async () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  // v1 fit_score is deferred (Phase-3) → the badge shows the pending sparkle. The
  // mock seed already ships a null score; pin it explicitly here to keep the test's
  // intent obvious — this exercises the v1 "pending" state the card actually ships with.
  const seed = result.current.recipes[0]
  const recipe = { ...seed, mezoFit: { ...seed.mezoFit, score: null } }
  const onOpen = vi.fn()
  render(<RecipeCard recipe={recipe} onOpen={onOpen} />, { wrapper: QueryWrapper })
  expect(screen.getByText(recipe.name)).toBeInTheDocument()
  // MacroCells labels are present.
  expect(screen.getByText('kcal')).toBeInTheDocument()
  expect(screen.getByText('Prot')).toBeInTheDocument()
  // v1 fit is pending → Mezo sparkle label.
  expect(screen.getByText('Mezo')).toBeInTheDocument()
  await userEvent.click(screen.getByText(recipe.name))
  expect(onOpen).toHaveBeenCalledWith(recipe)
})
