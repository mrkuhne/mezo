import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { DoneBar } from '@/features/train/components/DoneBar'

test('renders the summary and the quiet detail line', () => {
  const { container } = render(<DoneBar summary="RPE 8 · 60 perc" detail="07:12-kor logolva" />)
  expect(screen.getByText('RPE 8 · 60 perc')).toBeInTheDocument()
  expect(screen.getByText('07:12-kor logolva')).toBeInTheDocument()
  // Folyadék (mezo-n4wf5.3, prototype `doneIn()`): an indented line — tick bubble, bold summary, quiet detail
  expect(container.querySelector('.em-in.em-done')?.textContent).toBe('RPE 8 · 60 perc · 07:12-kor logolva')
  expect(container.querySelector('.donebar, .glass')).toBeNull()
  // the done mark is the tick glyph in its green bubble, with a spoken meaning
  expect(screen.getByRole('img', { name: 'kész' }).querySelector('use')?.getAttribute('href')).toBe('#t-tick')
  // no handler -> no link
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('omits the detail line entirely when absent', () => {
  const { container } = render(<DoneBar summary="RPE 8" />)
  expect(container.querySelector('.em-done-detail')).not.toBeInTheDocument()
  expect(container.querySelector('.em-in.em-done')?.textContent).toBe('RPE 8')
})

test('carries a labelled „Megnézem" link when onClick is given', () => {
  const onClick = vi.fn()
  render(<DoneBar summary="RPE 8 · 60 perc" onClick={onClick} ariaLabel="Logolt session megnyitása" />)
  expect(screen.getByRole('button', { name: 'Logolt session megnyitása' }).textContent).toBe('Megnézem')
  fireEvent.click(screen.getByRole('button', { name: 'Logolt session megnyitása' }))
  expect(onClick).toHaveBeenCalledTimes(1)
})
