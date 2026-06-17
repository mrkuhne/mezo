import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseActionSheet } from './ExerciseActionSheet'

const REMAINING = [
  { id: 'ex2', label: 'Lat Pulldown' },
  { id: 'ex3', label: 'Cable Pull-Around' },
]

test('clicking Áthelyezés reveals the reorder list with the remaining labels', async () => {
  const user = userEvent.setup()
  render(
    <ExerciseActionSheet
      exerciseName="Chest Supported Row"
      remaining={REMAINING}
      onReorder={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  await user.click(screen.getByText('Áthelyezés'))
  expect(screen.getByText('Lat Pulldown')).toBeInTheDocument()
  expect(screen.getByText('Cable Pull-Around')).toBeInTheDocument()
})

test('moving a remaining exercise up calls onReorder with the new id order', async () => {
  const onReorder = vi.fn()
  const user = userEvent.setup()
  render(
    <ExerciseActionSheet
      exerciseName="Chest Supported Row"
      remaining={REMAINING}
      onReorder={onReorder}
      onClose={vi.fn()}
    />,
  )
  await user.click(screen.getByText('Áthelyezés'))
  await user.click(screen.getByRole('button', { name: 'Cable Pull-Around feljebb' }))
  expect(onReorder).toHaveBeenLastCalledWith(['ex3', 'ex2'])
})

test('reorder view shows the empty message when fewer than 2 remaining', async () => {
  render(
    <ExerciseActionSheet
      exerciseName="Chest Supported Row"
      remaining={[{ id: 'ex2', label: 'Lat Pulldown' }]}
      onReorder={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  await userEvent.click(screen.getByText('Áthelyezés'))
  expect(screen.getByText('Nincs átrendezhető gyakorlat')).toBeInTheDocument()
})

test('the un-wired action rows (Kihagyás, Szett, Jegyzet) are present but disabled', () => {
  render(
    <ExerciseActionSheet
      exerciseName="Chest Supported Row"
      remaining={REMAINING}
      onReorder={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: /Kihagyás/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Szett/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Jegyzet/ })).toBeDisabled()
})
