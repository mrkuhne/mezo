import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from './router'
import { ThemeProvider } from './ThemeProvider'

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)
}

test('redirects / to Today', () => {
  renderApp('/')
  expect(screen.getByText(/briefing/i)).toBeInTheDocument()
})
test('navigates between tabs by clicking the bottom nav', async () => {
  renderApp('/today')
  await userEvent.click(screen.getByText('Insights'))
  expect(screen.getByRole('heading', { level: 1, name: /insights/i })).toBeInTheDocument()
})
test('FAB opens and the sheet closes again', async () => {
  renderApp('/today')
  await userEvent.click(screen.getByRole('button', { name: 'Gyors rögzítés' }))
  expect(screen.getByText(/Mi van veled/)).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByText(/Mi van veled/)).not.toBeInTheDocument())
})
test('Me screen theme toggle flips data-theme', async () => {
  renderApp('/me')
  document.documentElement.removeAttribute('data-theme')
  await userEvent.click(screen.getByRole('button', { name: 'Beállítások' }))
  await userEvent.click(screen.getByRole('switch', { name: 'Téma váltás' }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
})
