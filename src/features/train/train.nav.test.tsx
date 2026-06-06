import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

test('Train opens on Mai and the sub-nav switches between sub-tabs', async () => {
  renderApp('/train')
  expect(screen.getByText('07:30 · 78p')).toBeInTheDocument()
  expect(screen.getByText('Heti terv · gym + sport')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('link', { name: 'Sport' }))
  expect(screen.getByText('BVSC csarnok')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('link', { name: 'Mesociklusok' }))
  expect(screen.getByText('Hypertrophy 04 · Tavasz')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('link', { name: 'GYM' }))
  expect(screen.getByText('W3 / 6')).toBeInTheDocument()
})

test('the active workout session is a full-screen flow without the sub-nav', () => {
  const { container } = renderApp('/train/session')
  expect(container.querySelector('.subnav')).toBeNull()
  expect(screen.getByText(/Kezdjük el/)).toBeInTheDocument()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
})

test('the mesocycle planner is a full-screen flow without the sub-nav', () => {
  const { container } = renderApp('/train/mesocycles/new')
  expect(container.querySelector('.subnav')).toBeNull()
  expect(screen.getByText('Mit szeretnénk építeni?')).toBeInTheDocument()
})

test('the mesocycle builder is a full-screen flow without the sub-nav', () => {
  const { container } = renderApp('/train/mesocycles/meso-hyp-04')
  expect(container.querySelector('.subnav')).toBeNull()
  expect(
    screen.getByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' }),
  ).toBeInTheDocument()
})
