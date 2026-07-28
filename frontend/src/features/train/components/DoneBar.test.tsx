import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { DoneBar } from '@/features/train/components/DoneBar'

test('renders the summary and the quiet detail line', () => {
  const { container } = render(<DoneBar summary="RPE 8 · 60 perc" detail="07:12-kor logolva" />)
  expect(screen.getByText('RPE 8 · 60 perc')).toBeInTheDocument()
  expect(screen.getByText('07:12-kor logolva')).toBeInTheDocument()
  expect(container.querySelector('.donebar')).toBeInTheDocument()
  // no handler -> not a button
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('omits the detail line entirely when absent', () => {
  const { container } = render(<DoneBar summary="RPE 8" />)
  expect(container.querySelector('.donebar-detail')).not.toBeInTheDocument()
})

test('is a labelled button when onClick is given', () => {
  const onClick = vi.fn()
  render(<DoneBar summary="RPE 8 · 60 perc" onClick={onClick} ariaLabel="Logolt session megnyitása" />)
  fireEvent.click(screen.getByRole('button', { name: 'Logolt session megnyitása' }))
  expect(onClick).toHaveBeenCalledTimes(1)
})
