import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { ArrivalProvider, useArrival } from '@/shared/ui/mozaik/arrival'

// Arrival mode (mezo-kuwj): "did the user ARRIVE at this screen, or RETURN to it?".
// A return (the browser/OS back gesture -> POP) must not replay the screen's entrance
// choreography — that replay is the flash the user reported on swipe-back.

function ArrivalProbe() {
  return <output>{useArrival()}</output>
}

function NavButton({ label, to }: { label: string, to: string | number }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(to as string)}>{label}</button>
}

function arrival(): string {
  return screen.getByRole('status').textContent ?? ''
}

test('useArrival is "push" outside a provider — router-less component tests and portaled sheets keep animating', () => {
  render(<ArrivalProbe />)
  expect(arrival()).toBe('push')
})

test('the initial document load counts as "push", even though react-router reports POP for it', () => {
  // createBrowserHistory/createMemoryHistory both start with `action = "POP"`, so a naive
  // `useNavigationType() === 'POP'` read would kill the entrance choreography on cold start.
  render(<MemoryRouter><ArrivalProvider><ArrivalProbe /></ArrivalProvider></MemoryRouter>)
  expect(arrival()).toBe('push')
})

test('a back navigation flips the arrival to "pop"', () => {
  render(
    <MemoryRouter initialEntries={['/a', '/b']} initialIndex={1}>
      <ArrivalProvider>
        <ArrivalProbe />
        <NavButton label="back" to={-1} />
      </ArrivalProvider>
    </MemoryRouter>,
  )
  expect(arrival()).toBe('push')
  fireEvent.click(screen.getByRole('button', { name: 'back' }))
  expect(arrival()).toBe('pop')
})

test('a forward in-app navigation keeps the arrival "push"', () => {
  render(
    <MemoryRouter initialEntries={['/a']}>
      <ArrivalProvider>
        <ArrivalProbe />
        <NavButton label="deeper" to="/a/deeper" />
      </ArrivalProvider>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'deeper' }))
  expect(arrival()).toBe('push')
})

test('pushing again AFTER a back navigation returns the arrival to "push"', () => {
  // The flag must track the LATEST navigation, not latch on the first POP.
  render(
    <MemoryRouter initialEntries={['/a', '/b']} initialIndex={1}>
      <ArrivalProvider>
        <ArrivalProbe />
        <NavButton label="back" to={-1} />
        <NavButton label="deeper" to="/a/deeper" />
      </ArrivalProvider>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'back' }))
  expect(arrival()).toBe('pop')
  fireEvent.click(screen.getByRole('button', { name: 'deeper' }))
  expect(arrival()).toBe('push')
})
