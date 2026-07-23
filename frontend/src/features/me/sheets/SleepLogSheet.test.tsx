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

test('includes inBedMin when the optional field is filled', async () => {
  const onSave = vi.fn()
  render(<SleepLogSheet onClose={vi.fn()} onSave={onSave} />)
  await userEvent.type(screen.getByLabelText('Ágyban összesen (perc)'), '480')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ inBedMin: 480 }))
})
