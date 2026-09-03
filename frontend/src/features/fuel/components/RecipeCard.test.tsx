import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { RecipeCard } from '@/features/fuel/components/RecipeCard'
import { useRecipes } from '@/data/hooks'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the name, tinted macro cells and pending fit; click opens', async () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  // v1 fit_score is deferred (Phase-3) → the badge shows the pending sparkle. The
  // mock seed already ships a null score; pin it explicitly here to keep the test's
  // intent obvious — this exercises the v1 "pending" state the card actually ships with.
  const seed = result.current.recipes[0]
  const recipe = { ...seed, mezoFit: { ...seed.mezoFit, score: null } }
  const onOpen = vi.fn()
  render(<RecipeCard recipe={recipe} onOpen={onOpen} />, { wrapper: QueryWrapper })
  expect(screen.getByText(recipe.name)).toBeInTheDocument()
  // MCells labels are present (Receptek v2: kcal · fehérje · szénh. · zsír).
  expect(screen.getByText('kcal')).toBeInTheDocument()
  expect(screen.getByText('fehérje')).toBeInTheDocument()
  // v1 fit is pending → the band fit pill shows the Mezo sparkle, never a number.
  expect(screen.getByText('✨ Mezo')).toBeInTheDocument()
  await userEvent.click(screen.getByText(recipe.name))
  expect(onOpen).toHaveBeenCalledWith(recipe)
})

test('a scored recipe shows the rounded fit number + "fit" in the same band slot', () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const seed = result.current.recipes[0]
  const recipe = { ...seed, mezoFit: { ...seed.mezoFit, score: 0.91 } }
  render(<RecipeCard recipe={recipe} onOpen={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByText('91 fit')).toBeInTheDocument()
  expect(screen.queryByText('✨ Mezo')).not.toBeInTheDocument()
})

// Role tag (mezo-uavr) — the card names a non-standard rubric; „Általános" is the
// implicit default and never earns a tag.
test('tags a non-standard role, and only a non-standard role', () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const seed = result.current.recipes[0]
  const preWorkout = { ...seed, role: 'pre_workout' as const }
  const standard = { ...seed, role: 'standard' as const }
  const { rerender } = render(<RecipeCard recipe={preWorkout} onOpen={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Edzés előtt')).toBeInTheDocument()
  rerender(<RecipeCard recipe={standard} onOpen={() => {}} />)
  expect(screen.queryByText('Általános')).toBeNull()
})

test('a makró-strip egy adagra vetít — a bázis nem a teljes recept', () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const baseRecipe = result.current.recipes[0]
  const recipe = { ...baseRecipe, servings: 2, macros: { kcal: 800, p: 60, c: 80, f: 20 } }
  render(<RecipeCard recipe={recipe} onOpen={() => {}} />, { wrapper: QueryWrapper })

  expect(screen.getByText('400')).toBeInTheDocument() // 800 / 2 adag
  expect(screen.getByText('30 g')).toBeInTheDocument() // 60 / 2
  // Design 2.0 (Daniel): "nem kell a /adag kiírás" — the per-serving math stays the
  // contract, but the rail label is gone.
  expect(screen.queryByText('/adag')).not.toBeInTheDocument()
})

// NOVA hue contract (design-2.0 spec): 1 sage, 2-3 amber, 4 terracotta — NEVER the
// error/red token. This guards against the pre-redesign `var(--error)` regression.
test('NOVA 4 renders the terracotta dot class, never an error/red one', () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const seed = result.current.recipes[0]
  const recipe = { ...seed, novaDominant: 4 as const }
  const { container } = render(<RecipeCard recipe={recipe} onOpen={() => {}} />, { wrapper: QueryWrapper })
  const dot = container.querySelector('.mz-rcp-novadot')
  expect(dot).toHaveClass('n4')
  expect(dot?.className).not.toMatch(/error/i)
})

// Live footer (audit gap #7): timesLogged/avgScore/lastLogged were in the contract but
// never shown anywhere in the app before this redesign.
test('live footer surfaces timesLogged/avgScore/lastLogged when the recipe has been logged', () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const seed = result.current.recipes[0]
  const recipe = { ...seed, timesLogged: 18, avgScore: 0.91, lastLogged: 'tegnap' }
  render(<RecipeCard recipe={recipe} onOpen={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByText('18× logolva')).toBeInTheDocument()
  expect(screen.getByText('✨ 91 p átlag')).toBeInTheDocument()
  expect(screen.getByText('utoljára tegnap')).toBeInTheDocument()
})

test('an unlogged recipe honestly reads "még nem logoltad" — no fabricated stats', () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const seed = result.current.recipes[0]
  const recipe = { ...seed, timesLogged: 0, avgScore: 0, lastLogged: '—' }
  render(<RecipeCard recipe={recipe} onOpen={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByText('még nem logoltad')).toBeInTheDocument()
  expect(screen.queryByText(/× logolva/)).not.toBeInTheDocument()
  expect(screen.queryByText(/p átlag/)).not.toBeInTheDocument()
})
