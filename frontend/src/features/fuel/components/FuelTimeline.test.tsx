import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { FuelTimeline } from '@/features/fuel/components/FuelTimeline'
import { useFuelTimeline } from '@/data/hooks'
import { QueryWrapper } from '@/test/queryWrapper'

// FuelTimeline renders supplement slots → SupplementItemRow → dual-mode useStack (mezo-09g),
// so it needs a QueryClientProvider; pin mock mode for the seeded stash + timeline.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup(onOpenScore = () => {}) {
  // useFuelTimeline composes dual-mode TanStack queries (mezo-9ys) → needs a QueryClient
  // (mock mode seeds them synchronously).
  const { result } = renderHook(() => useFuelTimeline(), { wrapper: QueryWrapper })
  render(
    <QueryWrapper>
      <FuelTimeline slots={result.current.plan.slots} getScoredMeal={result.current.getScoredMeal} onOpenScore={onOpenScore} />
    </QueryWrapper>,
  )
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
test('threads onLogMeal through to a suggestion slot title', async () => {
  const onLogMeal = vi.fn()
  const slots: FuelSlot[] = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', state: 'pending', mealName: 'Zabkása', suggestedRecipeId: 'r1', kcal: 480, p: 30, c: 55, f: 12 },
  ]
  render(<FuelTimeline slots={slots} getScoredMeal={() => null} onOpenScore={() => {}} onLogMeal={onLogMeal} />)
  await userEvent.click(screen.getByRole('button', { name: 'Zabkása logolása' }))
  expect(onLogMeal).toHaveBeenCalledWith(slots[0])
})
