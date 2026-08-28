import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Mezo tab navigation after the shell dissolution (mezo-d20.5.1): the Insights
// SubNavDropdown is gone — /mezo is the hub Mozaik face, and the former sub-tabs are
// full-page siblings reached through the hub's tiles. The legacy /insights paths keep
// redirecting into /mezo with the subpath preserved.

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

describe('mezo nav (real mode default)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('the hub tiles reach Minták / Memoár / Előrejelzések / Kísérletek as full pages', async () => {
    const router = renderApp('/mezo')
    // The hub replaces the dropdown shell — no subnav button any more.
    expect(screen.queryByLabelText('Insights alnavigáció')).not.toBeInTheDocument()

    // Minták is a sibling page now (the hub owns the /mezo index).
    await userEvent.click(await screen.findByRole('button', { name: 'Minták' }))
    expect(router.state.location.pathname).toBe('/mezo/patterns')
    expect(await screen.findByText('A motor állapota')).toBeInTheDocument()

    // Memoár — un-ghosted at W2, navigates to the honest placeholder.
    router.navigate('/mezo')
    await userEvent.click(await screen.findByRole('button', { name: 'Memoár' }))
    expect(await screen.findByText('Az első memoár a hét zárásakor készül el.')).toBeInTheDocument()

    // Előrejelzések — the honest still-learning state.
    router.navigate('/mezo')
    await userEvent.click(await screen.findByRole('button', { name: 'Előrejelzések' }))
    expect(
      await screen.findByText('Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.'),
    ).toBeInTheDocument()

    // Kísérletek — its null-state.
    router.navigate('/mezo')
    await userEvent.click(await screen.findByRole('button', { name: 'Kísérletek' }))
    expect(
      await screen.findByText('Az első N=1 kísérletet a megerősített mintákból javasolja Mezo.'),
    ).toBeInTheDocument()

    // Memória — reached through the L0→L3 memory band, not a tile.
    router.navigate('/mezo')
    await userEvent.click(await screen.findByRole('button', { name: 'Memória-rétegek' }))
    expect(router.state.location.pathname).toBe('/mezo/memoria')
    expect(await screen.findByText('L0 · Nyers adat')).toBeInTheDocument()
  })

  test('the Heti tile crosses to /me/week', async () => {
    const router = renderApp('/mezo')
    await userEvent.click(await screen.findByRole('button', { name: 'Heti' }))
    expect(router.state.location.pathname).toBe('/me/week')
  })

  test('/mezo/weekly stays an honest redirect to /me/week (mezo-p2tr)', async () => {
    const router = renderApp('/mezo/weekly')
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/week'))
  })
})

describe('mezo nav (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('Memoár tile navigation renders the demo memoir', async () => {
    renderApp('/mezo')
    await userEvent.click(await screen.findByRole('button', { name: 'Memoár' }))
    expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
  })

  test('the legacy /insights paths land on the Mezo pages with the subpath preserved', async () => {
    const router = renderApp('/insights/memoir')
    expect(await screen.findByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/mezo/memoir')
  })
})
