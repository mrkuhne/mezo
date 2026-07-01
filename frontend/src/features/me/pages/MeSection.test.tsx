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

test('/me shows Profil with the sub-nav', () => {
  renderApp('/me')
  expect(screen.getByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument()
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
  document.documentElement.removeAttribute('data-theme')
  renderApp('/me')
  await userEvent.click(screen.getByRole('button', { name: 'Beállítások' }))
  await userEvent.click(screen.getByRole('switch', { name: 'Téma váltás' }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
})

test('deep-links directly to /me/people', () => {
  renderApp('/me/people')
  expect(screen.getByRole('heading', { level: 1, name: /Kapcsolatok/ })).toBeInTheDocument()
})
