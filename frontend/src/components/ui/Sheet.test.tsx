import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet } from '@/components/ui/Sheet'

test('renders handle + children', () => {
  render(<Sheet onClose={() => {}}><p>tartalom</p></Sheet>)
  expect(screen.getByText('tartalom')).toBeInTheDocument()
  expect(document.querySelector('.sheet-handle')).toBeTruthy()
})
test('supports render-prop children receiving an animated close', () => {
  render(<Sheet onClose={() => {}}>{(close) => <button onClick={close}>zár</button>}</Sheet>)
  expect(screen.getByRole('button', { name: 'zár' })).toBeInTheDocument()
})
test('closes on backdrop click (after slide-down)', async () => {
  const onClose = vi.fn()
  render(<Sheet onClose={onClose}><p>x</p></Sheet>)
  await userEvent.click(document.querySelector('.sheet-backdrop')!)
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
})
test('does not close when clicking inside the sheet', async () => {
  const onClose = vi.fn()
  render(<Sheet onClose={onClose}><p>belül</p></Sheet>)
  await userEvent.click(screen.getByText('belül'))
  expect(onClose).not.toHaveBeenCalled()
})
test('closes on Escape (after slide-down)', async () => {
  const onClose = vi.fn()
  render(<Sheet onClose={onClose}><p>x</p></Sheet>)
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
})
