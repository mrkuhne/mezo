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

  test('Insights opens on Minták; Heti link works; Memoár link works', async () => {
    renderApp('/insights')
    expect(screen.getByRole('heading', { level: 1, name: 'Minták' })).toBeInTheDocument()
    expect(await screen.findByText(/Új minták ·/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Heti' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Heti riport' })).toBeInTheDocument()
    // Memoár is un-ghosted at W2 — the link is visible and navigates to the honest placeholder.
    await userEvent.click(screen.getByRole('link', { name: 'Memoár' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Memoár' })).toBeInTheDocument()
    expect(await screen.findByText('Az első memoir a hét zárásakor készül el.')).toBeInTheDocument()
    // Előrejelzések is un-ghosted at P1 — visible and navigates to the honest still-learning state.
    await userEvent.click(screen.getByRole('link', { name: 'Előrejelzések' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Előrejelzések' })).toBeInTheDocument()
    expect(
      await screen.findByText('Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.'),
    ).toBeInTheDocument()
    // Kísérletek is un-ghosted at P2 — the last ghost; visible and navigates to its null-state.
    await userEvent.click(screen.getByRole('link', { name: 'Kísérletek' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Kísérletek' })).toBeInTheDocument()
    expect(
      await screen.findByText('Az első N=1 kísérletet a megerősített mintákból javasolja Mezo.'),
    ).toBeInTheDocument()
  })
})

describe('insights nav (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('Memoár navigation renders the demo memoir', async () => {
    renderApp('/insights')
    await userEvent.click(screen.getByRole('link', { name: 'Memoár' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Memoár' })).toBeInTheDocument()
    expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
  })
})
