import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FuelTimeline } from '@/features/fuel/components/FuelTimeline'
import { useFuelTimeline } from '@/data/hooks'

function setup(onOpenScore = () => {}) {
  const { result } = renderHook(() => useFuelTimeline())
  render(<FuelTimeline slots={result.current.plan.slots} getScoredMeal={result.current.getScoredMeal} onOpenScore={onOpenScore} />)
  return result.current
}
test('renders a row per slot with its time + meal name + MOST chip', () => {
  setup()
  expect(screen.getByText('05:50')).toBeInTheDocument()
  expect(screen.getByText(/Túrós zabkása/)).toBeInTheDocument()
  expect(screen.getByText('MOST')).toBeInTheDocument()    // the now-slot chip (16:00)
})
test('AI-score button opens the score sheet for a scored meal', async () => {
  const onOpenScore = vi.fn()
  setup(onOpenScore)
  const aiButtons = screen.getAllByRole('button', { name: /AI/ })
  expect(aiButtons.length).toBeGreaterThanOrEqual(1)   // ≈2 (09:15 + 13:00)
  await userEvent.click(aiButtons[0])
  expect(onOpenScore).toHaveBeenCalled()
})
