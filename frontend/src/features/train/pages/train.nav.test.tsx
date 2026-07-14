import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Asserts Phase-1 mock meso/sport data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('Train opens on Mai and the sub-nav switches between sub-tabs', async () => {
  renderApp('/train')
  expect(screen.getByText('MA 07:30 · MAV')).toBeInTheDocument()
  expect(screen.getByText('Heti terv')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('link', { name: 'Sport' }))
  expect(screen.getByText('BVSC csarnok')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('link', { name: 'Mesociklusok' }))
  expect(screen.getByText('Hypertrophy 04 · Tavasz')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('link', { name: 'Gym' }))
  expect(screen.getByText('W3 / 6')).toBeInTheDocument()
})

test('the active workout session is a full-screen flow without the sub-nav', () => {
  const { container } = renderApp('/train/session')
  expect(container.querySelector('.np-pills')).toBeNull()
  expect(screen.getByText(/Kezdjük el/)).toBeInTheDocument()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
})

test('the mesocycle planner is a full-screen flow without the sub-nav', () => {
  const { container } = renderApp('/train/mesocycles/new')
  expect(container.querySelector('.np-pills')).toBeNull()
  expect(screen.getByText('Mit szeretnénk építeni?')).toBeInTheDocument()
})

test('the mesocycle builder is a full-screen flow without the sub-nav', () => {
  const { container } = renderApp('/train/mesocycles/meso-hyp-04')
  expect(container.querySelector('.np-pills')).toBeNull()
  expect(
    screen.getByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' }),
  ).toBeInTheDocument()
})
