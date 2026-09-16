import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SetEditSheet, type SetEditValues } from '@/features/train/sheets/SetEditSheet'

const base = {
  exerciseName: 'Fekvenyomás',
  setLabel: '1. working szett',
  mode: 'logged' as const,
  kind: 'working' as const,
  exerciseType: 'compound' as const,
  initial: { weight: 82.5, reps: 9, rir: 2, side: null, note: '' } satisfies SetEditValues,
  canDelete: true,
  onSave: () => {},
  onDelete: () => {},
  onClose: () => {},
}

test('a logged working set offers save + delete and the RIR row', () => {
  render(<SetEditSheet {...base} />)
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Szett törlése/ })).toBeEnabled()
  expect(screen.getByLabelText('RIR 2')).toBeInTheDocument()
  expect(screen.getByText('Fekvenyomás')).toBeInTheDocument()
  // A compound exercise shows the weight stepper and hides the Side row — the
  // mirror image of the plyo/isolation assertions below, so a regression that
  // removed the stepper unconditionally or rendered Side unconditionally would
  // be caught here too.
  expect(screen.getByLabelText('Súly növelése')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'L' })).not.toBeInTheDocument()
})

test('the RIR row shows all 6 buttons (0-5) and the correct one is pressed', () => {
  const initial = { weight: 82.5, reps: 9, rir: 5, side: null, note: '' } satisfies SetEditValues
  render(<SetEditSheet {...base} initial={initial} />)
  // Verify all six RIR buttons render
  for (let i = 0; i <= 5; i++) {
    expect(screen.getByLabelText(`RIR ${i}`)).toBeInTheDocument()
  }
  // Verify the button matching rir is pressed
  const pressedButton = screen.getByLabelText('RIR 5')
  expect(pressedButton).toHaveAttribute('aria-pressed', 'true')
  // Verify the others are not pressed
  for (let i = 0; i <= 4; i++) {
    const btn = screen.getByLabelText(`RIR ${i}`)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  }
})

test('save reports the full current state, including untouched side and note', async () => {
  const onSave = vi.fn()
  const initial: SetEditValues = { weight: 82.5, reps: 9, rir: 2, side: 'L', note: 'nyújtás után' }
  render(<SetEditSheet {...base} initial={initial} onSave={onSave} />)
  await userEvent.click(screen.getByLabelText('Ismétlés növelése'))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  // Full object equality (not objectContaining): a regression that dropped
  // `side`/`note` from the reported payload must fail this assertion.
  expect(onSave).toHaveBeenCalledWith({ weight: 82.5, reps: 10, rir: 2, side: 'L', note: 'nyújtás után' })
})

test('a warmup set hides the RIR row', () => {
  render(<SetEditSheet {...base} kind="warmup" setLabel="B1 bemelegítő szett" />)
  expect(screen.queryByLabelText('RIR 2')).not.toBeInTheDocument()
})

test('an isolation exercise offers the Side row', () => {
  render(<SetEditSheet {...base} exerciseType="isolation" />)
  expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument()
})

test('a plyo exercise hides the weight stepper', () => {
  render(<SetEditSheet {...base} exerciseType="plyo" />)
  expect(screen.queryByLabelText('Súly növelése')).not.toBeInTheDocument()
})

test('a pending slot offers delete only, with disabled inputs', () => {
  render(<SetEditSheet {...base} mode="pending" />)
  expect(screen.queryByRole('button', { name: /Mentés/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Szett törlése/ })).toBeEnabled()
  expect(screen.getByLabelText('Ismétlés növelése')).toBeDisabled()
})

test('the last remaining slot cannot be deleted and says why', () => {
  render(<SetEditSheet {...base} canDelete={false} />)
  expect(screen.getByRole('button', { name: /Szett törlése/ })).toBeDisabled()
  expect(screen.getByText(/Az utolsó szett nem törölhető/)).toBeInTheDocument()
})
