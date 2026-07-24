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

test('/me shows the Profil route with the header dropdown', async () => {
  renderApp('/me')
  expect(await screen.findByText('Biometria')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Profil' })).toHaveAttribute('aria-haspopup', 'menu')
})

test('the dropdown lists all seven Me sub-views and navigates to Cél', async () => {
  server.use(http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])))
  renderApp('/me')
  await userEvent.click(screen.getByRole('button', { name: 'Profil' }))
  for (const label of ['Profil', 'Growth', 'Cél', 'Súly', 'Alvás', 'Emberek', 'Tudás']) {
    expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
  }
  await userEvent.click(screen.getByRole('menuitem', { name: 'Cél' }))
  expect(await screen.findByRole('heading', { level: 1, name: /Hosszú cél/ })).toBeInTheDocument()
})

test('Beállítások menu item opens SettingsSheet and the theme selector flips data-theme', async () => {
  // Default is circadian-auto (wall-clock dependent); preset manual light to keep this
  // smoke test deterministic. CircadianTheme.test covers the auto resolution.
  localStorage.setItem('mezo-theme', 'light')
  renderApp('/me')
  await userEvent.click(screen.getByRole('button', { name: 'Profil' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Beállítások' }))
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Sötét/ }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('deep-links directly to /me/people', () => {
  renderApp('/me/people')
  expect(screen.getByRole('heading', { level: 1, name: /Kapcsolatok/ })).toBeInTheDocument()
  // AppHero is Me section chrome — it renders above the Outlet on sub-pages too.
  expect(document.querySelector('.apphero')).toBeInTheDocument()
})
