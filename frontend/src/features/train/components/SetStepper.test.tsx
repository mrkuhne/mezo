import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetStepper } from '@/features/train/components/SetStepper'

// Folyadék F4 (mezo-n4wf5.4): the kit's `Stepper` row — the label carries the unit, the value is a text field
// named after the label (always typeable — there is no separate button that swaps a field in).

test('renders hu-decimal value with unit and steps by ±step', () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={107.5} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  expect(screen.getByLabelText('Súly')).toHaveValue('107,5')
  expect(screen.getByText('Súly · kg')).toBeInTheDocument()
  expect(document.querySelector('.fo-row .fo-stp')).not.toBeNull()
  expect(document.querySelector('.stepper')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Súly növelése' }))
  expect(onChange).toHaveBeenCalledWith(110)
  fireEvent.click(screen.getByRole('button', { name: 'Súly csökkentése' }))
  expect(onChange).toHaveBeenCalledWith(105)
})

test('integer mode and min clamp', () => {
  const onChange = vi.fn()
  render(<SetStepper label="Ismétlés" value={1} step={1} integer min={1} max={100} onChange={onChange} />)
  expect(screen.getByLabelText('Ismétlés')).toHaveValue('1')
  fireEvent.click(screen.getByRole('button', { name: 'Ismétlés csökkentése' }))
  expect(onChange).toHaveBeenCalledWith(1) // clamped at min
})

test('max clamp, and disabled switches off the field and both buttons', () => {
  const onChange = vi.fn()
  const { rerender } = render(<SetStepper label="Ismétlés" value={100} step={1} integer min={1} max={100} onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Ismétlés növelése' }))
  expect(onChange).toHaveBeenCalledWith(100) // clamped at max
  rerender(<SetStepper label="Ismétlés" value={8} step={1} integer min={1} max={100} disabled onChange={onChange} />)
  expect(screen.getByLabelText('Ismétlés')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Ismétlés növelése' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Ismétlés csökkentése' })).toBeDisabled()
})

// ---- typeable value (mezo-o7ds): exact values the ± step can't reach ----

test('the value is typeable and honors an exact (non-2.5) typed weight', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={95} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  const input = screen.getByLabelText('Súly') as HTMLInputElement
  await userEvent.clear(input)
  await userEvent.type(input, '93')
  await userEvent.tab() // blur commits + clamps
  expect(onChange).toHaveBeenCalledWith(93)
  // editing closed → the field reads the committed value again, the Hungarian way
  expect(screen.getByLabelText('Súly')).toHaveValue('95')
})

test('typed HU decimal comma is accepted', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={90} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  const input = screen.getByLabelText('Súly')
  await userEvent.clear(input)
  await userEvent.type(input, '92,5')
  await userEvent.tab()
  expect(onChange).toHaveBeenCalledWith(92.5)
})

test('a microplate weight is kept exactly — no rounding to one decimal (mezo-py1i6)', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={100} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  const input = screen.getByLabelText('Súly')
  await userEvent.clear(input)
  await userEvent.type(input, '101,25')
  await userEvent.tab()
  expect(onChange).toHaveBeenCalledWith(101.25)
})

test('typed value clamps to max and Enter commits', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={90} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  const input = screen.getByLabelText('Súly')
  await userEvent.clear(input)
  await userEvent.type(input, '1200{enter}') // Enter blurs → commit
  expect(onChange).toHaveBeenCalledWith(999)
})

test('emptied entry reverts without onChange', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={90} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  await userEvent.clear(screen.getByLabelText('Súly'))
  await userEvent.tab()
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Súly')).toHaveValue('90') // committed value untouched
})

test('integer stepper accepts an exact typed rep count', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Ismétlés" value={8} step={1} integer min={1} max={100} onChange={onChange} />)
  const input = screen.getByLabelText('Ismétlés')
  await userEvent.clear(input)
  await userEvent.type(input, '12')
  await userEvent.tab()
  expect(onChange).toHaveBeenCalledWith(12)
})

test('focusing the field shows the raw draft and selects it, so typing replaces the value', async () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={107.5} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  const input = screen.getByLabelText('Súly') as HTMLInputElement
  await userEvent.click(input)
  expect(input).toHaveValue('107.5')
  expect(input.selectionStart).toBe(0)
  expect(input.selectionEnd).toBe(5)
  await userEvent.keyboard('60')
  await userEvent.tab()
  expect(onChange).toHaveBeenCalledWith(60)
})
