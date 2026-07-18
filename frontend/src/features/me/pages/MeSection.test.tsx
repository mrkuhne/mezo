import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
}

test('/me shows the Profil route with the sub-nav', async () => {
  // The Profil h1 moved out with the page-header chrome (AppHero is section-level
  // now, mezo-8141/mezo-k7rn) — the route is proven by its card content instead.
  renderApp('/me')
  expect(await screen.findByText('Biometria')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Cél' })).toBeInTheDocument()
})

test('clicking the sub-nav navigates to Cél', async () => {
  // GoalsPage runs in REAL mode here (default), so its active-goal query must
  // resolve or it stays in the loading skeleton (mezo-f2z) and never renders the
  // page header. Serve an empty goal list → the empty-state still carries the
  // `/Hosszú cél/` heading this test asserts. weight/trend/profile use the default
  // handlers. The heading appears after the query settles → findByRole (async).
  server.use(http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])))
  renderApp('/me')
  await userEvent.click(screen.getByRole('link', { name: 'Cél' }))
  expect(await screen.findByRole('heading', { level: 1, name: /Hosszú cél/ })).toBeInTheDocument()
})

test('gear chip opens SettingsSheet and theme toggle flips data-theme', async () => {
  localStorage.clear()
  renderApp('/me')
  await userEvent.click(screen.getByRole('button', { name: 'Beállítások' }))
  // Light is the default (no attribute; light is the CSS base); toggling flips to dark.
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('switch', { name: 'Téma váltás' }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('deep-links directly to /me/people', () => {
  renderApp('/me/people')
  expect(screen.getByRole('heading', { level: 1, name: /Kapcsolatok/ })).toBeInTheDocument()
  // AppHero is Me section chrome — it renders above the Outlet on sub-pages too.
  expect(document.querySelector('.apphero')).toBeInTheDocument()
})
