import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

test('PhoneFrame outside a router falls back to the nap domain palette', () => {
  const { container } = render(<PhoneFrame><div /></PhoneFrame>)
  expect(container.querySelector('.phone-screen')!.getAttribute('data-domain')).toBe('nap')
})
test('PhoneFrame inside a router carries the active domain', () => {
  const { container } = render(<MemoryRouter initialEntries={['/fuel/stack']}><PhoneFrame><div /></PhoneFrame></MemoryRouter>)
  expect(container.querySelector('.phone-screen')!.getAttribute('data-domain')).toBe('fuel')
})
