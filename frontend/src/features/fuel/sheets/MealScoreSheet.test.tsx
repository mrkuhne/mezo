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

function renderSheet(onClose = () => {}) {
  const { result } = renderHook(() => useFuelDay(), { wrapper: QueryWrapper })
  const meal = result.current.fuel.meals.find(m => m.breakdown)!
  render(<MealScoreSheet meal={meal} onClose={onClose} />)
  return meal
}
test('renders the score hero, summary and 4 dimension cards', () => {
  const meal = renderSheet()
  expect(screen.getByText(meal.title)).toBeInTheDocument()
  expect(screen.getByText('Súlyozott bontás')).toBeInTheDocument()
  expect(screen.getByText('4 dimenzió')).toBeInTheDocument()
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
