import type { ComponentProps } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { DayBudgetCard } from '@/features/fuel/components/DayBudgetCard'

const base = {
  consumed: { kcal: 790, p: 58, c: 92, f: 22, water: 1850 },
  budget: { kcal: 3010, p: 185, c: 265, f: 86 },
  waterTarget: 4000,
  energy: { base: 2380, activity: 930, balance: -300, target: 3010 },
  staticEnergy: false,
  loggedKcals: [580, 210],
  doneCount: 2,
  totalCount: 5,
  nowFrac: 0.42,
}

const renderCard = (over: Partial<ComponentProps<typeof DayBudgetCard>> = {}) => {
  const onOpenEnergy = over.onOpenEnergy ?? vi.fn()
  const onLogWater = over.onLogWater ?? vi.fn()
  const result = render(<DayBudgetCard {...base} {...over} onOpenEnergy={onOpenEnergy} onLogWater={onLogWater} />)
  return { ...result, onOpenEnergy, onLogWater }
}

test('leads with the REMAINING kcal — the number a decision is made from', () => {
  renderCard()
  expect(screen.getByText('2220')).toBeInTheDocument()
  expect(screen.getByText(/790 \/ 3010/)).toBeInTheDocument()
  expect(screen.getByText('26%')).toBeInTheDocument()
  expect(screen.getByText(/2\/5 ablak/)).toBeInTheDocument()
})

test('an overshot day clamps the remaining number at zero instead of going negative', () => {
  renderCard({ consumed: { ...base.consumed, kcal: 3300 } })
  expect(screen.getByText('0')).toBeInTheDocument()
  expect(screen.getByText('110%')).toBeInTheDocument()
})

test('renders one segment per logged meal plus the ghost remainder', () => {
  const { container } = renderCard()
  expect(container.querySelectorAll('.dayseg > i')).toHaveLength(2)
  expect(container.querySelector('.dayseg .ghost')).toBeInTheDocument()
  expect(container.querySelector('.dayseg .mark')).toBeInTheDocument()
})

test('hides the now tick when there is no now window', () => {
  const { container } = renderCard({ nowFrac: null })
  expect(container.querySelector('.dayseg .mark')).toBeNull()
})

test('explains where the target comes from with three tappable chips', async () => {
  const { onOpenEnergy } = renderCard()
  expect(screen.getByText(/honnan a 3010 kcal/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Alaphő 2380/ }))
  expect(onOpenEnergy).toHaveBeenCalledWith('base')
  await userEvent.click(screen.getByRole('button', { name: /Mozgás \+930/ }))
  expect(onOpenEnergy).toHaveBeenCalledWith('movement')
  await userEvent.click(screen.getByRole('button', { name: /Deficit 300/ }))
  expect(onOpenEnergy).toHaveBeenCalledWith('deficit')
})

test('a surplus balance reads Felesleg, a zero balance Egyensúly', () => {
  const surplus = renderCard({ energy: { ...base.energy, balance: 250 } })
  expect(within(surplus.container).getByRole('button', { name: /Felesleg \+250/ })).toBeInTheDocument()
  surplus.unmount()

  const zero = renderCard({ energy: { ...base.energy, balance: 0 } })
  expect(within(zero.container).getByRole('button', { name: 'Egyensúly' })).toBeInTheDocument()
})

test('hides the breakdown chips on the static-energy fallback path', () => {
  renderCard({ staticEnergy: true })
  expect(screen.queryByText(/honnan a/i)).toBeNull()
  expect(screen.queryByRole('button', { name: /Alaphő/ })).toBeNull()
})

test('renders four named macro rows with absolute values, water last', () => {
  const { container } = renderCard()
  expect(container.querySelectorAll('.mac')).toHaveLength(4)
  expect(screen.getByText('Fehérje')).toBeInTheDocument()
  expect(screen.getByText('Szénhidrát')).toBeInTheDocument()
  expect(screen.getByText('Zsír')).toBeInTheDocument()
  expect(screen.getByText('Víz')).toBeInTheDocument()
  expect(screen.getByText(/58/)).toBeInTheDocument()
  expect(screen.getByText(/\/ 185 g/)).toBeInTheDocument()
  expect(screen.getByText(/1850/)).toBeInTheDocument()
  expect(screen.getByText(/\/ 4000 ml/)).toBeInTheDocument()
})

test('the water row keeps the quick-add buttons and their aria-labels', async () => {
  const { onLogWater } = renderCard()
  await userEvent.click(screen.getByRole('button', { name: 'Víz +250 ml' }))
  await userEvent.click(screen.getByRole('button', { name: 'Víz +500 ml' }))
  expect(onLogWater).toHaveBeenNthCalledWith(1, 250)
  expect(onLogWater).toHaveBeenNthCalledWith(2, 500)
})
