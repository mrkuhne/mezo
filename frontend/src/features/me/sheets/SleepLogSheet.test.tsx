import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'

test('Save bubbles up a SleepLogInput with computed duration then closes', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<SleepLogSheet onClose={onClose} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ bedtime: '23:00', wakeup: '06:30', durationH: 7.5, quality: 7, awakenings: 1 }),
  )
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
