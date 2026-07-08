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
