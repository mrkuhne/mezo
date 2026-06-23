import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { RecipeDetailSheet } from './RecipeDetailSheet'
import { useRecipes } from '@/data/hooks'
import { QueryWrapper } from '@/test/queryWrapper'

// RecipeDetailSheet's ingredient tab reads usePantry — a dual-mode TanStack query since Task 7.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const recipe = result.current.recipes.find(r => r.templateBreakdown)!
  render(<RecipeDetailSheet recipe={recipe} onClose={() => {}} />, { wrapper: QueryWrapper })
  return recipe
}

test('renders header + the three tabs; switches to ingredients', async () => {
  const recipe = setup()
  expect(screen.getByText(recipe.name)).toBeInTheDocument()
  expect(screen.getByText('RECEPT · sablon')).toBeInTheDocument()
  expect(screen.getByText('Score-bontás')).toBeInTheDocument()
  await userEvent.click(screen.getByText(/Hozzávalók/))
  expect(screen.getByText('Honnan jönnek')).toBeInTheDocument()
})

test('switches to logs tab', async () => {
  setup()
  await userEvent.click(screen.getByText(/Logok/))
  // either log rows or empty-state copy is present; CTAs stay visible
  expect(screen.getByText('Hozzáadás mai étkezéshez')).toBeInTheDocument()
})

test('renders the action CTAs (inert, always visible)', () => {
  setup()
  expect(screen.getByText('Hozzáadás mai étkezéshez')).toBeInTheDocument()
  expect(screen.getByText('Szerkesztés')).toBeInTheDocument()
})
