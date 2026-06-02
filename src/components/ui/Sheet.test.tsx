import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet } from './Sheet'

test('renders handle + children', () => {
  render(<Sheet onClose={() => {}}><p>tartalom</p></Sheet>)
  expect(screen.getByText('tartalom')).toBeInTheDocument()
  expect(document.querySelector('.sheet-handle')).toBeTruthy()
})
test('closes on backdrop click', async () => {
  const onClose = vi.fn()
  render(<Sheet onClose={onClose}><p>x</p></Sheet>)
  await userEvent.click(document.querySelector('.sheet-backdrop')!)
  expect(onClose).toHaveBeenCalledOnce()
})
test('does not close when clicking inside the sheet', async () => {
  const onClose = vi.fn()
  render(<Sheet onClose={onClose}><p>belül</p></Sheet>)
  await userEvent.click(screen.getByText('belül'))
  expect(onClose).not.toHaveBeenCalled()
})
test('closes on Escape', async () => {
  const onClose = vi.fn()
  render(<Sheet onClose={onClose}><p>x</p></Sheet>)
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledOnce()
})
