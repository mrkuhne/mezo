import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckInStrip } from '@/features/today/components/CheckInStrip'
import { initialCheckins } from '@/data/today/checkins'

test('renders 4 beats, the "Hogy vagy ma?" header + N/4 count, and calls onCheckIn on tap', async () => {
  const onCheckIn = vi.fn()
  const { container } = render(<CheckInStrip checkins={initialCheckins} onCheckIn={onCheckIn} />)
  expect(container.querySelectorAll('.beat')).toHaveLength(4)
  expect(screen.getByText('Hogy vagy ma?')).toBeInTheDocument()
  expect(screen.getByText('2/4')).toBeInTheDocument()
  await userEvent.click(container.querySelectorAll('.beat')[2])
  expect(onCheckIn).toHaveBeenCalledWith(2)
})

test('renders done/now/pending slot content per state', () => {
  const { container } = render(<CheckInStrip checkins={initialCheckins} onCheckIn={vi.fn()} />)
  const beats = container.querySelectorAll('.beat')
  expect(beats[0]).toHaveClass('done')
  expect(beats[2]).toHaveClass('now')
  expect(screen.getByText('koppints')).toBeInTheDocument()
  expect(screen.getByText('·')).toBeInTheDocument()
})
