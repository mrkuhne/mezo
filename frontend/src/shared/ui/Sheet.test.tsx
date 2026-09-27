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

// mezo-zz91i follow-up: the sheet's own box is a non-scrolling FRAME — a glass hairline painted
// on it (`.glass::before`) must always outline the whole visible sheet, never scroll away with
// tall content. Children live in an inner `.sheet-scroll`; the drag handle stays outside it, in
// the frame, so it's always visible regardless of scroll position.
test('children render inside .sheet-scroll; the handle zone stays outside it', () => {
  render(<Sheet onClose={() => {}}><p>tartalom</p></Sheet>)
  const dialog = screen.getByRole('dialog')
  const scroll = dialog.querySelector('.sheet-scroll')
  expect(scroll).toBeTruthy()
  expect(scroll!.contains(screen.getByText('tartalom'))).toBe(true)
  const handleZone = dialog.querySelector('.sheet-handle-zone')!
  expect(scroll!.contains(handleZone)).toBe(false)
  expect(dialog.contains(handleZone)).toBe(true)
  // the handle zone comes before the scroller — the handle is always the first thing on screen
  expect(handleZone.compareDocumentPosition(scroll!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

// U10 (mezo-me75u.10): `glass` opts the sheet into the kit's floating glass recipe; without it
// the caller's own className is untouched (the slices that dressed their sheets keep their scope).
test('glass opts into the kit glass sheet, and only then', () => {
  const { unmount } = render(<Sheet glass className="x-own" onClose={() => {}}>a</Sheet>)
  expect(screen.getByRole('dialog')).toHaveClass('sheet', 'glass', 'uv-sheet', 'x-own')
  unmount()
  render(<Sheet className="x-own" onClose={() => {}}>b</Sheet>)
  expect(screen.getByRole('dialog')).not.toHaveClass('uv-sheet')
})
