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
  const { container } = render(
    <QueryWrapper>
      <FuelTimeline slots={result.current.plan.slots} getScoredMeal={result.current.getScoredMeal} onOpenScore={onOpenScore} />
    </QueryWrapper>,
  )
  return { ...result.current, container }
}
test('renders a row per slot (.slot/.fav/.mrow) with its time + meal name, and marks the now-slot .next with a "következő" mrow marker', () => {
  const { container } = setup()
  expect(screen.getByText('06:45')).toBeInTheDocument()      // the computed wake (Ébresztő) slot — sleep goal 06:45
  expect(screen.getByText(/Túrós zabkása/)).toBeInTheDocument()
  expect(screen.getByText('következő')).toBeInTheDocument()   // the now-slot's mrow marker (fixed mock now 13:30)
  expect(container.querySelectorAll('.slot').length).toBeGreaterThan(0)
  expect(container.querySelector('.slot.next')).toBeInTheDocument()
  expect(container.querySelector('.fav')).toBeInTheDocument()
  expect(container.querySelector('.mrow')).toBeInTheDocument()
})
test('a pending supplement-item slot (esti stack) shows a 🌙 status marker', () => {
  setup()
  expect(screen.getAllByText('🌙').length).toBeGreaterThanOrEqual(1)
})
test('AI-score button opens the score sheet for a scored meal', async () => {
  const onOpenScore = vi.fn()
  setup(onOpenScore)
  const aiButtons = screen.getAllByRole('button', { name: /AI/ })
  expect(aiButtons.length).toBeGreaterThanOrEqual(1)   // ≈3 scored meals (09:15 m1 + 13:00 m2 + 16:00 m3)
  await userEvent.click(aiButtons[0])
  expect(onOpenScore).toHaveBeenCalled()
})
test('threads onLogMeal through the suggestion slot\'s Logolás pill', async () => {
  const onLogMeal = vi.fn()
  const slots: FuelSlot[] = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', state: 'pending', mealName: 'Zabkása', suggestedRecipeId: 'r1', kcal: 480, p: 30, c: 55, f: 12 },
  ]
  render(<FuelTimeline slots={slots} getScoredMeal={() => null} onOpenScore={() => {}} onLogMeal={onLogMeal} />)
  await userEvent.click(screen.getByRole('button', { name: 'Zabkása logolása' }))
  expect(onLogMeal).toHaveBeenCalledWith(slots[0])
})
