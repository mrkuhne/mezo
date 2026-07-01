import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'

test('shows the header and switches to text mode', async () => {
  render(<QuickInputSheet onClose={() => {}} />)
  expect(screen.getByText(/Mi van veled/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Szöveg/ }))
  expect(screen.getByPlaceholderText(/Free note/)).toBeInTheDocument()
})

test('close chip calls onClose (after slide-down)', async () => {
  const onClose = vi.fn()
  render(<QuickInputSheet onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
