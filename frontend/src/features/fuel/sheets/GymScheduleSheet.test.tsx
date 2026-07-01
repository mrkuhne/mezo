import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderHook } from '@testing-library/react'
import { GymScheduleSheet } from '@/features/fuel/sheets/GymScheduleSheet'
import { useFuelWeek } from '@/data/hooks'

function setup(onSave = () => {}, onClose = () => {}) {
  const { result } = renderHook(() => useFuelWeek())
  render(<GymScheduleSheet schedule={result.current.gymSchedule} onSave={onSave} onClose={onClose} />)
}

test('renders the schedule editor with day rows', () => {
  setup()
  expect(screen.getByText('Heti gym idők')).toBeInTheDocument()
})

test('Mentés calls onSave with the edited schedule then closes', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  setup(onSave, onClose)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => {
    expect(onSave).toHaveBeenCalledWith(expect.any(Array))
    expect(onClose).toHaveBeenCalled()
  })
})
