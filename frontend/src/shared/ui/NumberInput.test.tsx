import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { NumberInput } from '@/shared/ui/NumberInput'

function Harness({ initial = 73.4 as number | null }) {
  const [v, setV] = useState<number | null>(initial)
  return (
    <>
      <NumberInput value={v} onChange={setV} aria-label="Testsúly" />
      <output>{v === null ? 'null' : v}</output>
    </>
  )
}

test('clearing the field commits null on blur — never 0 (Rule 4)', () => {
  render(<Harness />)
  const input = screen.getByLabelText('Testsúly')
  fireEvent.change(input, { target: { value: '' } })
  expect(input).toHaveValue('')          // stays empty while focused
  fireEvent.blur(input)
  expect(screen.getByText('null')).toBeInTheDocument()
  expect(input).toHaveValue('')
})

test('typing a decimal (comma accepted) commits on blur', () => {
  render(<Harness />)
  const input = screen.getByLabelText('Testsúly')
  fireEvent.change(input, { target: { value: '72,8' } })
  fireEvent.blur(input)
  expect(screen.getByText('72.8')).toBeInTheDocument()
})

test('garbage input reverts to the last committed value', () => {
  render(<Harness />)
  const input = screen.getByLabelText('Testsúly')
  fireEvent.change(input, { target: { value: 'abc' } })
  fireEvent.blur(input)
  expect(screen.getByText('73.4')).toBeInTheDocument()
  expect(input).toHaveValue('73.4')
})

test('external value change syncs the field', () => {
  const { rerender } = render(<NumberInput value={5} onChange={() => {}} aria-label="n" />)
  rerender(<NumberInput value={9} onChange={() => {}} aria-label="n" />)
  expect(screen.getByLabelText('n')).toHaveValue('9')
})
