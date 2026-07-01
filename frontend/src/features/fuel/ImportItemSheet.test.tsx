import { render, screen, act, fireEvent } from '@testing-library/react'
import { ImportItemSheet } from '@/features/fuel/ImportItemSheet'

test('input phase has the URL field and quick-import chips', () => {
  render(<ImportItemSheet onClose={() => {}} />)
  expect(screen.getByText('Új tétel a Kamrába')).toBeInTheDocument()
  expect(screen.getByText('VAGY · gyors-import')).toBeInTheDocument()
})
test('scraping advances to preview after the timeout', async () => {
  // NOTE: the task spec drove this click via `userEvent.click`, but
  // userEvent v14's pointer simulation deadlocks under `vi.useFakeTimers()`
  // (its internal awaited timer never auto-flushes), so the click promise
  // never resolves and the test times out. The button under test is a plain
  // onClick, so `fireEvent.click` exercises identical component behaviour
  // while keeping the timer-advance assertions and verbatim strings intact.
  vi.useFakeTimers()
  render(<ImportItemSheet onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /Adatok lehúzása/ }))
  expect(screen.getByText('Scraping')).toBeInTheDocument()
  await act(async () => { vi.advanceTimersByTime(1500) })
  expect(screen.getByText('Beolvasva')).toBeInTheDocument()
  vi.useRealTimers()
})
