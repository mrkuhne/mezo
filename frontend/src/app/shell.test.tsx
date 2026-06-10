import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusBar } from './StatusBar'
import { PhoneFrame } from './PhoneFrame'
import { Fab } from './Fab'

test('StatusBar shows default clock and status icons', () => {
  const { container } = render(<StatusBar />)
  expect(screen.getByText('13:42')).toBeInTheDocument()
  expect(container.querySelector('.status-icons')).toBeTruthy()
})
test('PhoneFrame applies anchor class when anchor', () => {
  const { container } = render(<PhoneFrame anchor><div /></PhoneFrame>)
  expect(container.querySelector('.phone-screen.anchor')).toBeTruthy()
})
test('Fab fires onClick and renders mic icon', async () => {
  const onClick = vi.fn()
  const { container } = render(<Fab onClick={onClick} />)
  expect(container.querySelector('svg')).toBeTruthy()
  await userEvent.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledOnce()
})
