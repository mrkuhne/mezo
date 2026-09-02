import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { MealScoreSheet } from '@/features/fuel/sheets/MealScoreSheet'
import { useFuelDay } from '@/data/hooks'
import { QueryWrapper } from '@/test/queryWrapper'

// useFuelDay is now composed dual-mode (mezo-arb); pin mock mode so the seed (with its
// breakdown) is returned synchronously, and wrap renderHook in a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function seedScoredMeal() {
  const { result } = renderHook(() => useFuelDay(), { wrapper: QueryWrapper })
  return result.current.fuel.meals.find(m => m.breakdown)!
}
function renderSheet(onClose = () => {}) {
  const meal = seedScoredMeal()
  render(<MealScoreSheet meal={meal} onClose={onClose} />, { wrapper: QueryWrapper })
  return meal
}
test('renders the score hero, summary, the ledger and 8 collapsed dimension cards; no tools list (mezo-zeeq)', () => {
  const meal = renderSheet()
  expect(screen.getByText(meal.title)).toBeInTheDocument()
  expect(screen.getByText(/Miből áll össze a \d+/)).toBeInTheDocument()
  expect(screen.getByText('8 dimenzió · súlyozva')).toBeInTheDocument()
  expect(screen.getByLabelText('Pontszám-összetétel')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { expanded: false }).length).toBeGreaterThanOrEqual(8)
  expect(screen.queryByText('Hogyan számoltam')).not.toBeInTheDocument()
})
test('the hero carries the tone word and the Rost fact, the header the context chip', () => {
  renderSheet() // mock m1: fiberG present, no Szerep row → Standard
  expect(screen.getByText(/^(jó|közepes|gyenge)$/)).toBeInTheDocument()
  expect(screen.getByText('Rost')).toBeInTheDocument()
  expect(screen.getByText('Standard')).toBeInTheDocument()
})
test('Lehetne jobb renders the gain as pont', () => {
  renderSheet() // mock improve impacts are "+0.04 score" / "+0.01 score"
  expect(screen.getByText('+4')).toBeInTheDocument()
})
test('renders the derived name (not a blank header) for a scored meal with an empty title (mezo-u68c)', () => {
  const seed = seedScoredMeal()
  const titleless = { ...seed, title: '' } // pre-fix meal: null title coerced to '' (mealApi.ts)
  const derived = seed.mealItems.map(l => l.name).filter(n => n.trim().length > 0).join(', ')
  expect(derived.length).toBeGreaterThan(0)
  render(<MealScoreSheet meal={titleless} onClose={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByText(derived)).toBeInTheDocument()
})
test('summary section renders (SafeMarkdown, no innerHTML)', () => {
  renderSheet()
  expect(screen.getByText('Mezo · olvasat')).toBeInTheDocument()
})
test('close button dismisses', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
