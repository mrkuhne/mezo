import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { VoiceBubble, type VoiceBubbleInput } from '@/shared/ui/voice/VoiceBubble'

function voice(over: Partial<VoiceBubbleInput> = {}): VoiceBubbleInput {
  return { state: 'idle', error: null, toggle: vi.fn(), cancel: vi.fn(), levelRef: { current: 0 }, ...over }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('stays out of the way while idle', () => {
  render(<VoiceBubble voice={voice()} domain="me" />)
  expect(screen.queryByText('Figyelek')).not.toBeInTheDocument()
})

test('listening: says it is listening; tapping the bubble stops, ✕ cancels', () => {
  const v = voice({ state: 'recording' })
  render(<VoiceBubble voice={v} domain="me" />)
  expect(screen.getByText('Figyelek')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /felvétel leállítása/i }))
  expect(v.toggle).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: /mégse/i }))
  expect(v.cancel).toHaveBeenCalledTimes(1)
})

test('thinking: says the transcript is being written, with no stop or cancel', () => {
  render(<VoiceBubble voice={voice({ state: 'transcribing' })} domain="fuel" />)
  expect(screen.getByText(/Leírom, amit mondtál/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /mégse/i })).not.toBeInTheDocument()
})

test('done: a short "Beírtam" beat after transcribing, then it leaves', () => {
  const view = render(<VoiceBubble voice={voice({ state: 'transcribing' })} domain="me" />)
  view.rerender(<VoiceBubble voice={voice({ state: 'idle' })} domain="me" />)
  expect(screen.getByText('Beírtam')).toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(2000) })
  expect(screen.queryByText('Beírtam')).not.toBeInTheDocument()
})

test('sad: shows the error, then hides by itself', () => {
  render(<VoiceBubble voice={voice({ error: 'Nem hallottam semmit — próbáld újra.' })} domain="me" />)
  expect(screen.getByText('Nem hallottam semmit — próbáld újra.')).toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(5000) })
  expect(screen.queryByText('Nem hallottam semmit — próbáld újra.')).not.toBeInTheDocument()
})

test('tolerates a voice without cancel or level (older hook mocks)', () => {
  render(<VoiceBubble voice={{ state: 'recording', error: null, toggle: vi.fn() }} domain="mezo" />)
  expect(screen.getByText('Figyelek')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /mégse/i })).not.toBeInTheDocument()
})
