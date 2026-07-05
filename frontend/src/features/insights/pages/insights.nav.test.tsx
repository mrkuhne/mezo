import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

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

describe('insights nav (real mode default)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('Insights opens on Patterns; Weekly link works; Memoir is hidden', async () => {
    renderApp('/insights')
    expect(screen.getByRole('heading', { level: 1, name: 'Patterns' })).toBeInTheDocument()
    expect(await screen.findByText(/Új minták ·/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Memoir' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Weekly' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Weekly' })).toBeInTheDocument()
  })
})

describe('insights nav (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('Memoir navigation renders the demo memoir', async () => {
    renderApp('/insights')
    await userEvent.click(screen.getByRole('link', { name: 'Memoir' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Memoir' })).toBeInTheDocument()
    expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
  })
})
