import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Force reduced-motion so the np-draw/rz-breath entrance choreography never masks content
// under jsdom (stubReduced pattern, LevelUpScreen.test.tsx precedent).
function stubReduced(matches = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(() => vi.unstubAllGlobals())

function renderApp(path = '/ritual') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
}

test('act 1 (Megérkezés) renders the fixed arrival line and no tab bar', () => {
  stubReduced()
  const { container } = renderApp()
  expect(screen.getByText('A nap véget ért.')).toBeInTheDocument()
  expect(screen.getByText('Zárjuk le együtt.')).toBeInTheDocument()
  expect(container.querySelector('.tab-bar')).toBeNull()
})

test('clicking Kezdjük advances from act 1 to act 2 (DayStoryStep)', async () => {
  stubReduced()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByText(/Kezdjük/))
  expect(screen.getByText('A napod íve')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'A napod íve — összegzés' })).toBeInTheDocument()
  expect(screen.queryByText('A nap véget ért.')).not.toBeInTheDocument()
})

test('the ✕ exit (Kilépés) navigates straight to /today, consequence-free from act 1', async () => {
  stubReduced()
  const user = userEvent.setup()
  renderApp()
  await user.click(screen.getByRole('button', { name: 'Kilépés' }))
  expect(await screen.findByText(/briefing/i)).toBeInTheDocument()
})
