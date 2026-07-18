import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet } from '@/shared/ui/Sheet'

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

// mezo-91rw: in jsdom transitionend never fires, so the EXIT_MS+80 fallback
// setTimeout is the only path to onClose. If it survives unmount (RTL cleanup
// racing a mid-close sheet at a test file's end), it fires after environment
// teardown → setState on a torn-down jsdom → "window is not defined".
test('unmount clears the pending exit timer — no onClose after unmount', () => {
  vi.useFakeTimers()
  try {
    const onClose = vi.fn()
    const { unmount } = render(<Sheet onClose={onClose}><p>x</p></Sheet>)
    fireEvent.click(document.querySelector('.sheet-backdrop')!) // start the slide-down
    unmount() // teardown wins the race against the fallback timer
    vi.advanceTimersByTime(1000) // the ~380ms fallback would fire in this window
    expect(onClose).not.toHaveBeenCalled()
  } finally {
    vi.useRealTimers()
  }
})
