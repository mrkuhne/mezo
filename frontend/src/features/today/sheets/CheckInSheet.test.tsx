import { fireEvent, render, screen } from '@testing-library/react'
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


test('saves a long check-in note without truncating it', async () => {
  const onSave = vi.fn()
  render(<CheckInSheet slot={initialCheckins[2]} slotIdx={2} onClose={vi.fn()} onSave={onSave} />)
  for (let i = 0; i < 4; i++) {
    await userEvent.click(screen.getByRole('button', { name: /Kihagy/ }))
  }
  const note = 'Hosszabb gondolat a mai napról. '.repeat(100)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: note } })
  expect(input).toHaveValue(note)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ note: note.trim() }))
})


test('keeps the note and allows retry when persistence fails', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
  const onClose = vi.fn()
  render(<CheckInSheet slot={initialCheckins[2]} slotIdx={2} onClose={onClose} onSave={onSave} />)
  for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: /Kihagy/ }))
  const note = 'Megőrzendő hosszú gondolat. '.repeat(100)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: note } })
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('nem sikerült')
  expect(screen.getByRole('textbox')).toHaveValue(note)
  expect(onClose).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledTimes(2)
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ note: note.trim() }))
})
