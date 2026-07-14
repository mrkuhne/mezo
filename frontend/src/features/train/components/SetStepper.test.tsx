import { fireEvent, render, screen } from '@testing-library/react'
import { SetStepper } from '@/features/train/components/SetStepper'

test('renders hu-decimal value with unit and steps by ±step', () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={107.5} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  expect(screen.getByText('107,5')).toBeInTheDocument()
  expect(screen.getByText('kg')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Súly növelése' }))
  expect(onChange).toHaveBeenCalledWith(110)
  fireEvent.click(screen.getByRole('button', { name: 'Súly csökkentése' }))
  expect(onChange).toHaveBeenCalledWith(105)
})

test('integer mode and min clamp', () => {
  const onChange = vi.fn()
  render(<SetStepper label="Ismétlés" value={1} step={1} integer min={1} max={100} onChange={onChange} />)
  expect(screen.getByText('1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ismétlés csökkentése' }))
  expect(onChange).toHaveBeenCalledWith(1) // clamped at min
})
