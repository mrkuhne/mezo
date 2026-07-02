import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { KIND_META } from '@/data/kindMeta'
import { SlotCard } from '@/features/fuel/components/SlotCard'

const noop = () => {}

function renderCard(slot: FuelSlot, onLogMeal = vi.fn()) {
  render(
    <SlotCard
      slot={slot}
      meta={KIND_META[slot.kind] ?? KIND_META.meal}
      scoredMeal={null}
      onOpenScore={noop}
      onLogMeal={onLogMeal}
    />,
  )
  return onLogMeal
}

// ── Recipe-suggestion slot ─────────────────────────────────────────────────────
const suggestion: FuelSlot = {
  time: '08:00', kind: 'meal', label: 'Reggeli', state: 'pending',
  mealName: 'Túrós palacsinta', suggestedRecipeId: 'r1', kcal: 500, p: 35, c: 50, f: 15,
}

test('suggestion slot renders the recipe name + macros + an "ajánlott" chip', () => {
  renderCard(suggestion)
  expect(screen.getByText('Túrós palacsinta')).toBeInTheDocument()
  expect(screen.getByText('ajánlott')).toBeInTheDocument()
  expect(screen.getByText('500kcal')).toBeInTheDocument()
})

test('tapping a suggestion title fires onLogMeal(slot)', async () => {
  const onLogMeal = renderCard(suggestion)
  await userEvent.click(screen.getByRole('button', { name: 'Túrós palacsinta logolása' }))
  expect(onLogMeal).toHaveBeenCalledWith(suggestion)
})

// ── Budget-only pending slot ───────────────────────────────────────────────────
const budget: FuelSlot = {
  time: '12:30', kind: 'meal', label: 'Ebéd', state: 'pending', kcal: 700, p: 45, c: 70, f: 22,
}

test('budget-only slot renders its label + a "~kcal · P C F" budget line + a Logolás affordance', () => {
  renderCard(budget)
  expect(screen.getByText('Ebéd')).toBeInTheDocument()
  expect(screen.getByText('~700 kcal · P45 C70 F22')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ebéd logolása' })).toBeInTheDocument()
})

test('tapping the budget-only Logolás affordance fires onLogMeal(slot)', async () => {
  const onLogMeal = renderCard(budget)
  await userEvent.click(screen.getByRole('button', { name: 'Ebéd logolása' }))
  expect(onLogMeal).toHaveBeenCalledWith(budget)
})

// ── Workout / sport duration guard ─────────────────────────────────────────────
test('a workout slot without a duration renders no "· perc" suffix', () => {
  renderCard({ time: '17:00', kind: 'workout', label: 'Push A', state: 'pending' })
  expect(screen.getByText('Push A')).toBeInTheDocument()
  expect(screen.queryByText(/perc/)).not.toBeInTheDocument()
  expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
})

test('a workout slot with a duration keeps the "· N perc" suffix', () => {
  renderCard({ time: '17:00', kind: 'workout', label: 'Push A', state: 'pending', duration: 60 })
  expect(screen.getByText('Push A · 60 perc')).toBeInTheDocument()
})
