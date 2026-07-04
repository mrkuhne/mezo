import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymScheduleSheet } from '@/features/fuel/sheets/GymScheduleSheet'
// Prop-driven sheet test — fed the Phase-1 seed directly (useFuelWeek became a composed
// dual-mode hook in Fuel P4; the sheet itself stays mode-agnostic).
import { gymSchedule } from '@/data/fuel/fuelWeek'

function setup(onSave = () => {}, onClose = () => {}) {
  render(<GymScheduleSheet schedule={gymSchedule} onSave={onSave} onClose={onClose} />)
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
