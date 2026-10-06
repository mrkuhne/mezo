import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { GymExercise } from '@/data/types'
import { ExerciseRecipeRow, recipeSummary } from './ExerciseRecipeRow'

const ex: GymExercise = { id: 'e1', name: 'Lateral Raise', muscle: 'shoulder-side', warmupSets: 0, workingSets: 3,
  repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation', anchorWeightKg: null } as GymExercise

const setup = (over: Partial<Parameters<typeof ExerciseRecipeRow>[0]> = {}) => {
  const p = { ex, open: false, onToggle: vi.fn(), onRemove: vi.fn(), onChange: vi.fn(), ...over }
  render(<ExerciseRecipeRow {...p} />)
  return p
}

test('summary line names sets, reps, RIR and auto kg', () => {
  expect(recipeSummary(ex)).toBe('3 szett · 12–15 ism. · RIR 1 · auto kg')
  expect(recipeSummary({ ...ex, anchorWeightKg: 22.5 })).toBe('3 szett · 12–15 ism. · RIR 1 · 22,5 kg')
})

test('collapsed: head toggles, steppers hidden', () => {
  const p = setup()
  const head = screen.getByRole('button', { name: /Lateral Raise/ })
  expect(head).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'Lateral Raise · Working növelése' })).toBeNull()
  fireEvent.click(head)
  expect(p.onToggle).toHaveBeenCalled()
})

test('open: paired steppers clamp and patch', () => {
  const p = setup({ open: true })
  fireEvent.click(screen.getByRole('button', { name: 'Lateral Raise · Working növelése' }))
  expect(p.onChange).toHaveBeenCalledWith({ workingSets: 4 })
  fireEvent.click(screen.getByRole('button', { name: 'Lateral Raise · Bemelegítő csökkentése' }))
  expect(p.onChange).toHaveBeenLastCalledWith({ warmupSets: 0 }) // clamped at 0
  fireEvent.click(screen.getByRole('button', { name: 'Lateral Raise · Kiinduló súly növelése' }))
  expect(p.onChange).toHaveBeenLastCalledWith({ anchorWeightKg: 20 })
  expect(screen.getByText('Szettek')).toBeInTheDocument()
  expect(screen.getByText('Tartalék (RIR)')).toBeInTheDocument()
})

test('open: volume switch, move and remove', () => {
  const onMoveDown = vi.fn()
  const p = setup({ open: true, onMoveDown })
  const sw = screen.getByRole('switch', { name: 'Lateral Raise · számít a volumenbe' })
  expect(sw).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(sw)
  expect(p.onChange).toHaveBeenCalledWith({ countsTowardVolume: false })
  expect(screen.getByRole('button', { name: /Feljebb/ })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /Lejjebb/ }))
  expect(onMoveDown).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Lateral Raise törlése' }))
  expect(p.onRemove).toHaveBeenCalled()
})
