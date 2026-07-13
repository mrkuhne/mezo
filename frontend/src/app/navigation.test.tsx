import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
}

test('redirects / to Today', () => {
  renderApp('/')
  expect(screen.getByText(/briefing/i)).toBeInTheDocument()
})
test('navigates between tabs by clicking the bottom nav', async () => {
  renderApp('/today')
  await userEvent.click(screen.getByText('Insights'))
  // Insights shell: the brand eyebrow is the stable landmark; the page title is
  // dynamic per active sub-view (the index sub-view renders "Patterns").
  expect(screen.getByRole('heading', { level: 1, name: /patterns/i })).toBeInTheDocument()
  expect(screen.getByLabelText('Insights alnavigáció')).toBeInTheDocument()
})
test('Me screen theme toggle flips data-theme', async () => {
  localStorage.clear()
  renderApp('/me')
  await userEvent.click(screen.getByRole('button', { name: 'Beállítások' }))
  // Light is the default (no attribute; light is the CSS base); toggling flips to dark.
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('switch', { name: 'Téma váltás' }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})
