import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { FuelMeal } from '@/data/types'
import { MealScoreChip } from '@/features/fuel/components/MealScoreChip'

const meal = (score: number | null): FuelMeal => ({
  id: 'm1', slot: 'Ebéd', title: 'Csirkés rizs', score,
  kcal: 900, p: 68, c: 105, f: 24, mealItems: [], items: [], tags: [],
  loggedAt: '2026-07-28T13:10:00', mealDate: '2026-07-28',
})

test('renders nothing without a scored meal — no fabricated placeholder', () => {
  const { container } = render(<MealScoreChip meal={null} onOpen={vi.fn()} />)
  expect(container).toBeEmptyDOMElement()
})

test('a high score renders the sage tone with a one-word verdict', () => {
  const { container } = render(<MealScoreChip meal={meal(0.84)} onOpen={vi.fn()} />)
  const chip = screen.getByRole('button', { name: 'AI score' })
  expect(chip).toHaveTextContent('84')
  expect(chip).toHaveTextContent('jó')
  expect(container.querySelector('.aiscore.s-hi')).toBeInTheDocument()
})

test('a mid score renders amber "közepes", a low score coral "gyenge"', () => {
  const { container: mid } = render(<MealScoreChip meal={meal(0.74)} onOpen={vi.fn()} />)
  expect(mid.querySelector('.aiscore.s-md')).toBeInTheDocument()
  expect(mid.textContent).toContain('közepes')
  const { container: low } = render(<MealScoreChip meal={meal(0.41)} onOpen={vi.fn()} />)
  expect(low.querySelector('.aiscore.s-lo')).toBeInTheDocument()
  expect(low.textContent).toContain('gyenge')
})

test('a pending coach adds a twinkle marker — the number is final, the prose is not', () => {
  render(<MealScoreChip meal={meal(0.84)} coachPending onOpen={vi.fn()} />)
  expect(screen.getByTestId('coach-twinkle')).toBeInTheDocument()
})

test('no twinkle once the coach is settled', () => {
  render(<MealScoreChip meal={meal(0.84)} onOpen={vi.fn()} />)
  expect(screen.queryByTestId('coach-twinkle')).toBeNull()
})

test('clicking the chip opens the score sheet for that meal', async () => {
  const onOpen = vi.fn()
  const m = meal(0.84)
  render(<MealScoreChip meal={m} onOpen={onOpen} />)
  await userEvent.click(screen.getByRole('button', { name: 'AI score' }))
  expect(onOpen).toHaveBeenCalledWith(m)
})
