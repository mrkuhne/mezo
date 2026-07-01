import { render, screen, act, fireEvent } from '@testing-library/react'
import { ChatPage } from '@/features/insights/pages/ChatPage'

test('seeds the conversation and the composer', () => {
  render(<ChatPage />)
  expect(screen.getByText(/Jó reggelt\. Tegnap a Push Day/)).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Mondj valamit...')).toBeInTheDocument()
  // assistant tool-transparency chip
  expect(screen.getByText('get_recent_workouts(days=3)')).toBeInTheDocument()
})

test('sending a message appends it and then simulates a reply', async () => {
  // NOTE: the task spec drove typing via `userEvent.type(...{Enter})`, but
  // userEvent v14's input simulation deadlocks under `vi.useFakeTimers()` in
  // this environment (its internal awaited timers never auto-flush), so the
  // type promise never resolves and the test times out — the same issue
  // already documented in ImportItemSheet.test.tsx. The composer is a plain
  // controlled input with `onChange`/`onKeyDown=Enter`, so `fireEvent.change`
  // + `fireEvent.keyDown` exercise identical component behaviour while keeping
  // the fake-timer advance assertions and verbatim strings intact.
  vi.useFakeTimers()
  render(<ChatPage />)
  const input = screen.getByPlaceholderText('Mondj valamit...')
  fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.getByText('Fáradt vagyok')).toBeInTheDocument()
  await act(async () => {
    vi.advanceTimersByTime(1300)
  })
  expect(screen.getByText(/A Reta D3-on ez gyakori/)).toBeInTheDocument()
  vi.useRealTimers()
})
