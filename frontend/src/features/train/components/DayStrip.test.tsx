import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { DayStrip } from '@/features/train/components/DayStrip'
import type { DayStripItem } from '@/features/train/logic/dayStripItems'

const items: DayStripItem[] = [
  { day: 'Hét', dayNumber: 18, isToday: false, dots: ['gym', 'sport'], doneCount: 2, sessionCount: 2 },
  { day: 'Kedd', dayNumber: 19, isToday: true, dots: ['cross', 'run', 'sport'], doneCount: 1, sessionCount: 3 },
  { day: 'Vas', dayNumber: 24, isToday: false, dots: [], doneCount: 0, sessionCount: 0 },
]

test('renders one chip per day with tone-coloured dots', () => {
  const { container } = render(<DayStrip items={items} selected="Kedd" onSelect={() => {}} />)
  expect(container.querySelectorAll('.daychip')).toHaveLength(3)
  expect(container.querySelectorAll('.daychip')[1].querySelectorAll('.dot-cross, .dot-run, .dot-sport')).toHaveLength(3)
})

test('marks today, the selection and an empty rest day distinctly', () => {
  const { container } = render(<DayStrip items={items} selected="Kedd" onSelect={() => {}} />)
  const chips = container.querySelectorAll('.daychip')
  expect(chips[1].className).toContain('today')
  expect(chips[1].className).toContain('sel')
  expect(chips[2].className).toContain('rest')
  // today's chip is labelled MA, the others by their day key
  expect(screen.getByText('MA')).toBeInTheDocument()
  expect(screen.getByText('Hét')).toBeInTheDocument()
})

test('shows a done marker per logged session and a dash when nothing is logged', () => {
  render(<DayStrip items={items} selected="Kedd" onSelect={() => {}} />)
  expect(screen.getByText('✓✓')).toBeInTheDocument()   // Hét: 2 of 2
  expect(screen.getByText('✓')).toBeInTheDocument()     // Kedd: 1 of 3
  expect(screen.getByText('pihenő')).toBeInTheDocument()// Vas: no sessions
})

test('selecting a day calls onSelect with its day key', () => {
  const onSelect = vi.fn()
  render(<DayStrip items={items} selected="Kedd" onSelect={onSelect} />)
  fireEvent.click(screen.getByRole('tab', { name: /Hét/ }))
  expect(onSelect).toHaveBeenCalledWith('Hét')
})
