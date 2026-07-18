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

  test('Insights opens on Minták; the dropdown reaches Heti / Memoár / Előrejelzések / Kísérletek', async () => {
    renderApp('/insights')
    expect(screen.getByRole('button', { name: 'Minták' })).toHaveAttribute('aria-haspopup', 'menu')
    expect(await screen.findByText(/Új minták ·/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Minták' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Heti' }))
    expect(screen.getByRole('button', { name: 'Heti' })).toBeInTheDocument()

    // Memoár is un-ghosted at W2 — navigates to the honest placeholder.
    await userEvent.click(screen.getByRole('button', { name: 'Heti' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Memoár' }))
    expect(await screen.findByText('Az első memoár a hét zárásakor készül el.')).toBeInTheDocument()

    // Előrejelzések is un-ghosted at P1 — the honest still-learning state.
    await userEvent.click(screen.getByRole('button', { name: 'Memoár' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Előrejelzések' }))
    expect(
      await screen.findByText('Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.'),
    ).toBeInTheDocument()

    // Kísérletek is un-ghosted at P2 — its null-state.
    await userEvent.click(screen.getByRole('button', { name: 'Előrejelzések' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Kísérletek' }))
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
    await userEvent.click(screen.getByRole('button', { name: 'Minták' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Memoár' }))
    expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
  })
})
