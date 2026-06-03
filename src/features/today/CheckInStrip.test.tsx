import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckInStrip } from './CheckInStrip'
import { initialCheckins } from '@/data/checkins'

test('renders 4 slots, the N/4 count, and calls onCheckIn on tap', async () => {
  const onCheckIn = vi.fn()
  const { container } = render(<CheckInStrip checkins={initialCheckins} onCheckIn={onCheckIn} />)
  expect(container.querySelectorAll('.checkin-slot')).toHaveLength(4)
  expect(screen.getByText(/\/4 ma/)).toBeInTheDocument()
  await userEvent.click(container.querySelectorAll('.checkin-slot')[2])
  expect(onCheckIn).toHaveBeenCalledWith(2)
})
