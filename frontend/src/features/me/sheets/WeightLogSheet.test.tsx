import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeightLogSheet } from '@/features/me/sheets/WeightLogSheet'

test('prefills the current weight readout', () => {
  render(<WeightLogSheet onClose={() => {}} onSave={() => {}} currentWeight={72.4} />)
  expect(screen.getByText('72.4')).toBeInTheDocument()
})

test('Save bubbles up a WeightLogInput then closes', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<WeightLogSheet onClose={onClose} onSave={onSave} currentWeight={72.4} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 72.4, note: undefined }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
