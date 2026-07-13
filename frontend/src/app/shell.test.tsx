import { render, screen } from '@testing-library/react'
import { StatusBar } from '@/app/StatusBar'
import { PhoneFrame } from '@/app/PhoneFrame'
import { daypartNow } from '@/shared/lib/daypart'

test('StatusBar shows default clock and status icons', () => {
  const { container } = render(<StatusBar />)
  expect(screen.getByText('13:42')).toBeInTheDocument()
  expect(container.querySelector('.status-icons')).toBeTruthy()
})
test('PhoneFrame applies anchor class when anchor', () => {
  const { container } = render(<PhoneFrame anchor><div /></PhoneFrame>)
  expect(container.querySelector('.phone-screen.anchor')).toBeTruthy()
})
test('PhoneFrame carries the current daypart and renders the sky band', () => {
  const { container } = render(<PhoneFrame><div /></PhoneFrame>)
  const screenEl = container.querySelector('.phone-screen')!
  expect(screenEl.getAttribute('data-day')).toBe(daypartNow())
  expect(screenEl.querySelector('.sky')).not.toBeNull()
})
