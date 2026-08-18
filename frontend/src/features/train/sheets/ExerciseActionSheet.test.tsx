import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseActionSheet } from '@/features/train/sheets/ExerciseActionSheet'

const REORDERABLE = [
  { id: 'ex1', label: 'Chest Supported Row', current: true },
  { id: 'ex2', label: 'Lat Pulldown' },
  { id: 'ex3', label: 'Cable Pull-Around' },
]

test('clicking Áthelyezés reveals the reorder list with every reorderable label', async () => {
  const user = userEvent.setup()
  render(
    <ExerciseActionSheet
      exerciseName="Chest Supported Row"
      reorderable={REORDERABLE}
      onReorder={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  await user.click(screen.getByText('Áthelyezés'))
  expect(screen.getByText('Lat Pulldown')).toBeInTheDocument()
  expect(screen.getByText('Cable Pull-Around')).toBeInTheDocument()
})

// mezo-vad0: the exercise being done RIGHT NOW is reorderable too (busy machine →
// "let me do this one later"), so it heads the list and is marked as the current one.
test('the current exercise is listed first and badged "most"', async () => {
  const user = userEvent.setup()
  render(
    <ExerciseActionSheet
      exerciseName="Chest Supported Row"
      reorderable={REORDERABLE}
      onReorder={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  await user.click(screen.getByText('Áthelyezés'))
  const rows = document.querySelectorAll('[data-sortable-row]')
  expect(rows[0]).toHaveAttribute('data-sortable-row', 'ex1')
  expect(rows[0]).toHaveTextContent('Chest Supported Row')
  expect(within(rows[0] as HTMLElement).getByText('most')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Chest Supported Row lejjebb' })).toBeEnabled()
})

test('moving a remaining exercise up calls onReorder with the new id order', async () => {
  const onReorder = vi.fn()
  const user = userEvent.setup()
  render(
    <ExerciseActionSheet
      exerciseName="Chest Supported Row"
      reorderable={REORDERABLE}
      onReorder={onReorder}
      onClose={vi.fn()}
    />,
  )
  await user.click(screen.getByText('Áthelyezés'))
  await user.click(screen.getByRole('button', { name: 'Cable Pull-Around feljebb' }))
  expect(onReorder).toHaveBeenLastCalledWith(['ex1', 'ex3', 'ex2'])
})

test('reorder view shows the empty message when fewer than 2 reorderable exercises', async () => {
  render(
    <ExerciseActionSheet
      exerciseName="Chest Supported Row"
      reorderable={[{ id: 'ex2', label: 'Lat Pulldown' }]}
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
      reorderable={REORDERABLE}
      onReorder={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: /Kihagyás/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Szett/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Jegyzet/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Edzés befejezése/ })).toBeDisabled()
})

test('the finish row fires onFinishWorkout and closes the sheet', async () => {
  const onFinishWorkout = vi.fn()
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(
    <ExerciseActionSheet
      exerciseName="Chest Supported Row"
      reorderable={REORDERABLE}
      onReorder={vi.fn()}
      onFinishWorkout={onFinishWorkout}
      onClose={onClose}
    />,
  )
  await user.click(screen.getByRole('button', { name: /Edzés befejezése/ }))
  expect(onFinishWorkout).toHaveBeenCalledOnce()
})
