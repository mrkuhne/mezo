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
  expect(screen.getByText('500 kcal')).toBeInTheDocument()
})

test('tapping the suggestion Logolás CTA fires onLogMeal(slot)', async () => {
  const onLogMeal = renderCard(suggestion)
  await userEvent.click(screen.getByRole('button', { name: 'Túrós palacsinta logolása' }))
  expect(onLogMeal).toHaveBeenCalledWith(suggestion)
})

// ── Budget-only pending slot ───────────────────────────────────────────────────
const budget: FuelSlot = {
  time: '12:30', kind: 'meal', label: 'Ebéd', state: 'pending', kcal: 700, p: 45, c: 70, f: 22,
}

test('budget-only slot renders its label + a .mrow kcal/macro readout + a Logolás affordance', () => {
  renderCard(budget)
  expect(screen.getByText('Ebéd')).toBeInTheDocument()
  expect(screen.getByText('700 kcal')).toBeInTheDocument()
  expect(screen.getByText('F 45')).toBeInTheDocument()
  expect(screen.getByText('Sz 70')).toBeInTheDocument()
  expect(screen.getByText('Zs 22')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ebéd logolása' })).toBeInTheDocument()
})

test('tapping the budget-only Logolás affordance fires onLogMeal(slot)', async () => {
  const onLogMeal = renderCard(budget)
  await userEvent.click(screen.getByRole('button', { name: 'Ebéd logolása' }))
  expect(onLogMeal).toHaveBeenCalledWith(budget)
})

// ── Slot-level AI chip (mezo-53su) ─────────────────────────────────────────────
// An open meal/snack slot that carries a slotKey gets a second chip ("AI") beside Logolás,
// wired to onAiLog(slot). It renders ONLY when the slot is loggable (suggestion/budget), has a
// slotKey, and onAiLog is supplied — never on a done slot, never without a slotKey.
const budgetWithSlotKey: FuelSlot = {
  time: '12:30', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'pending', kcal: 700, p: 45, c: 70, f: 22,
}

test('an open budget slot with slotKey renders BOTH the Logolás and the AI chip', () => {
  render(
    <SlotCard slot={budgetWithSlotKey} meta={KIND_META.meal} scoredMeal={null} onOpenScore={noop} onLogMeal={vi.fn()} onAiLog={vi.fn()} />,
  )
  expect(screen.getByRole('button', { name: 'Ebéd logolása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ebéd AI-logolása' })).toBeInTheDocument()
})

test('clicking the AI chip fires onAiLog(slot)', async () => {
  const onAiLog = vi.fn()
  render(
    <SlotCard slot={budgetWithSlotKey} meta={KIND_META.meal} scoredMeal={null} onOpenScore={noop} onLogMeal={vi.fn()} onAiLog={onAiLog} />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Ebéd AI-logolása' }))
  expect(onAiLog).toHaveBeenCalledWith(budgetWithSlotKey)
})

test('a budget slot WITHOUT a slotKey renders Logolás but no AI chip', () => {
  render(
    <SlotCard slot={budget} meta={KIND_META.meal} scoredMeal={null} onOpenScore={noop} onLogMeal={vi.fn()} onAiLog={vi.fn()} />,
  )
  expect(screen.getByRole('button', { name: 'Ebéd logolása' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Ebéd AI-logolása' })).not.toBeInTheDocument()
})

test('a done slot renders neither the Logolás nor the AI chip', () => {
  const doneSlot: FuelSlot = {
    time: '09:15', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done',
    mealName: 'Zabkása', kcal: 500, p: 30, c: 55, f: 12,
  }
  render(
    <SlotCard slot={doneSlot} meta={KIND_META.meal} scoredMeal={null} onOpenScore={noop} onLogMeal={vi.fn()} onAiLog={vi.fn()} />,
  )
  expect(screen.queryByRole('button', { name: /logolása/ })).not.toBeInTheDocument()
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

// ── New Napiv slot template (.slot/.fav/.tx/.mrow/.st — mezo-8141) ─────────────
test('renders the .slot template with a .fav avatar and a .mrow meta row', () => {
  const { container } = render(
    <SlotCard slot={suggestion} meta={KIND_META[suggestion.kind]} scoredMeal={null} onOpenScore={noop} onLogMeal={vi.fn()} />,
  )
  expect(container.querySelector('.slot')).toBeInTheDocument()
  expect(container.querySelector('.fav')).toBeInTheDocument()
  expect(container.querySelector('.mrow')).toBeInTheDocument()
})

test('a done slot renders the .slot.done wrapper with a ✓ in its .st status circle', () => {
  const done: FuelSlot = {
    time: '09:15', kind: 'meal', label: 'Reggeli', state: 'done',
    mealName: 'Zabkása', kcal: 500, p: 30, c: 55, f: 12,
  }
  const { container } = render(
    <SlotCard slot={done} meta={KIND_META.meal} scoredMeal={null} onOpenScore={noop} onLogMeal={vi.fn()} />,
  )
  expect(container.querySelector('.slot.done')).toBeInTheDocument()
  expect(container.querySelector('.st')).toHaveTextContent('✓')
})

test('the now slot renders .slot.next with "következő" inside its .mrow', () => {
  const now: FuelSlot = {
    time: '16:00', kind: 'snack', label: 'Délutáni snack', state: 'now',
    mealName: 'Túró', kcal: 300, p: 30, c: 30, f: 10,
  }
  const { container } = render(
    <SlotCard slot={now} meta={KIND_META.snack} scoredMeal={null} onOpenScore={noop} onLogMeal={vi.fn()} />,
  )
  expect(container.querySelector('.slot.next')).toBeInTheDocument()
  expect(container.querySelector('.mrow')).toHaveTextContent('következő')
})
