import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { initialCheckins } from '@/data/today/checkins'

test('advances through dims and saves values', async () => {
  const onSave = vi.fn(); const onClose = vi.fn()
  render(<CheckInSheet slot={initialCheckins[2]} slotIdx={2} onClose={onClose} onSave={onSave} />)
  expect(screen.getByText(/Hogy vagyunk/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '8' }))
  for (let i = 0; i < 4; i++) {
    const skip = screen.queryByRole('button', { name: /Kihagy/ })
    if (skip) await userEvent.click(skip)
  }
  await userEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalled()
  expect(onSave.mock.calls[0][0].state).toBe('done')
})
