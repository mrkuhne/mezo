import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// ---- tap-to-edit (mezo-o7ds): exact values the ± step can't reach ----

test('the value is tap-to-edit and honors an exact (non-2.5) typed weight', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={95} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Súly pontos megadása' }))
  const input = screen.getByLabelText('Súly') as HTMLInputElement
  await userEvent.clear(input)
  await userEvent.type(input, '93')
  await userEvent.tab() // blur commits + clamps
  expect(onChange).toHaveBeenCalledWith(93)
  // editing closed → the resting display button is back
  expect(screen.getByRole('button', { name: 'Súly pontos megadása' })).toBeInTheDocument()
})

test('typed HU decimal comma is accepted', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={90} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Súly pontos megadása' }))
  const input = screen.getByLabelText('Súly')
  await userEvent.clear(input)
  await userEvent.type(input, '92,5')
  await userEvent.tab()
  expect(onChange).toHaveBeenCalledWith(92.5)
})

test('typed value clamps to max and Enter commits', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={90} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Súly pontos megadása' }))
  const input = screen.getByLabelText('Súly')
  await userEvent.clear(input)
  await userEvent.type(input, '1200{enter}') // Enter blurs → commit
  expect(onChange).toHaveBeenCalledWith(999)
})

test('emptied entry reverts without onChange', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={90} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Súly pontos megadása' }))
  await userEvent.clear(screen.getByLabelText('Súly'))
  await userEvent.tab()
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByText('90')).toBeInTheDocument() // committed value untouched
})

test('integer stepper accepts an exact typed rep count', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Ismétlés" value={8} step={1} integer min={1} max={100} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ismétlés pontos megadása' }))
  const input = screen.getByLabelText('Ismétlés')
  await userEvent.clear(input)
  await userEvent.type(input, '12')
  await userEvent.tab()
  expect(onChange).toHaveBeenCalledWith(12)
})
