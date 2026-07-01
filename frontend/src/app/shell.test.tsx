import { render, screen } from '@testing-library/react'
import { StatusBar } from './StatusBar'
import { PhoneFrame } from './PhoneFrame'

test('StatusBar shows default clock and status icons', () => {
  const { container } = render(<StatusBar />)
  expect(screen.getByText('13:42')).toBeInTheDocument()
  expect(container.querySelector('.status-icons')).toBeTruthy()
})
test('PhoneFrame applies anchor class when anchor', () => {
  const { container } = render(<PhoneFrame anchor><div /></PhoneFrame>)
  expect(container.querySelector('.phone-screen.anchor')).toBeTruthy()
})
