import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ExerciseEditRow } from '@/features/train/components/ExerciseEditRow'
import type { GymExercise } from '@/data/types'

const ex: GymExercise = {
  id: 'e1', name: 'Fekvenyomás', muscle: 'chest', type: 'compound',
  warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 0,
}

it('shows the recipe summary line', () => {
  render(<ExerciseEditRow ex={ex} onRemove={() => {}} onChange={() => {}} />)
  expect(screen.getByText(/2 bem · 3 work · 6-8 · RIR 0/)).toBeInTheDocument()
})

it('opens the editor and fires onChange with a recipe patch when a stepper is used', async () => {
  const onChange = vi.fn()
  render(<ExerciseEditRow ex={ex} onRemove={() => {}} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Szerkesztő' }))
  await userEvent.click(screen.getByRole('button', { name: 'Working növelése' }))
  expect(onChange).toHaveBeenCalledWith({ workingSets: 4 })
})

it('clamps Rep min to repMax so it can never exceed the current Rep max', async () => {
  const onChange = vi.fn()
  // repMin already at the ceiling (repMax): raising it must NOT produce an inverted
  // range (which would violate the DB ck_exercise_rep_range CHECK → 500 on PUT).
  render(<ExerciseEditRow ex={{ ...ex, repMin: 8, repMax: 8 }} onRemove={() => {}} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Szerkesztő' }))
  await userEvent.click(screen.getByRole('button', { name: 'Rep min növelése' }))
  // The clamp holds it at 8 — it never fires a patch that raises repMin past repMax.
  expect(onChange).not.toHaveBeenCalledWith({ repMin: 9 })
  expect(onChange).toHaveBeenCalledWith({ repMin: 8 })
})

it('anchor weight (mezo-anm4): starts at "auto" and sets a starting weight on +', async () => {
  const onChange = vi.fn()
  render(<ExerciseEditRow ex={ex} onRemove={() => {}} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Szerkesztő' }))
  expect(screen.getByText('auto')).toBeInTheDocument() // no anchor yet → engine decides
  await userEvent.click(screen.getByRole('button', { name: 'Kiinduló súly növelése' }))
  expect(onChange).toHaveBeenCalledWith({ anchorWeightKg: 20 }) // "+" from auto seeds 20 kg
})

it('anchor weight: decrementing below one step clears back to "auto" (null)', async () => {
  const onChange = vi.fn()
  render(<ExerciseEditRow ex={{ ...ex, anchorWeightKg: 2.5 }} onRemove={() => {}} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Szerkesztő' }))
  await userEvent.click(screen.getByRole('button', { name: 'Kiinduló súly csökkentése' }))
  expect(onChange).toHaveBeenCalledWith({ anchorWeightKg: null })
})

it('shows the anchor weight in the recipe summary when set', () => {
  render(<ExerciseEditRow ex={{ ...ex, anchorWeightKg: 42.5 }} onRemove={() => {}} onChange={() => {}} />)
  expect(screen.getByText(/RIR 0 · 42.5 kg/)).toBeInTheDocument()
})
