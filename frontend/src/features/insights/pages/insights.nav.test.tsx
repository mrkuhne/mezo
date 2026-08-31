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

  // mezo-d20.11 (1:1 fidelity audit, insights.md §9 / ADR 0032): the /mezo siblings shipped
  // WITHOUT a PageHead, so a user who tapped a tile could only leave via the tab bar. Every
  // sibling now owns the prototype's `‹ Mezo` chip.
  test.each([
    ['/mezo/patterns', '‹ Mezo'],
    ['/mezo/memoir', '‹ Mezo'],
    ['/mezo/knowledge', '‹ Mezo'],
    ['/mezo/predictions', '‹ Mezo'],
    ['/mezo/experiments', '‹ Mezo'],
    ['/mezo/memoria', '‹ Mezo'],
  ])('%s owns a back chip that returns to the hub', async (path, label) => {
    const router = renderApp(path)
    const back = await screen.findByRole('button', { name: 'Vissza' })
    expect(back).toHaveTextContent(label)
    await userEvent.click(back)
    await waitFor(() => expect(router.state.location.pathname).toBe('/mezo'))
  })

  // /mezo/chat dropped the shared PageHead for its own orb-led header (mezo-vdf4) — the back
  // disc is bare `‹`, and the `Mezo` name now sits next to the orb, not inside the back button.
  test('/mezo/chat owns a back disc that returns to the hub', async () => {
    const router = renderApp('/mezo/chat')
    const back = await screen.findByRole('button', { name: 'Vissza' })
    expect(back).toHaveTextContent('‹')
    expect(screen.getByText('Mezo', { selector: '.mzc-hnm' })).toBeInTheDocument()
    await userEvent.click(back)
    await waitFor(() => expect(router.state.location.pathname).toBe('/mezo'))
  })

  test('the pattern-pair detail goes back to the LIST it was opened from, not the hub', async () => {
    const router = renderApp('/mezo/patterns/late-meal~next-sleep-quality')
    const back = await screen.findByRole('button', { name: 'Vissza' })
    expect(back).toHaveTextContent('‹ Minták')
    await userEvent.click(back)
    await waitFor(() => expect(router.state.location.pathname).toBe('/mezo/patterns'))
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

  // mezo-d20.11: the cross-link used to be one-way (Memória → Minták only) and went through
  // the `/mezo/motor` redirect. Both directions are now direct.
  test('the Memória ↔ Minták cross-link is two-way and skips the /mezo/motor redirect', async () => {
    const router = renderApp('/mezo/patterns')
    await userEvent.click(await screen.findByRole('link', { name: /memória-rétegek/i }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/mezo/memoria'))
  })

  test('a pattern tile links straight at the sibling leaf, not through /insights', async () => {
    renderApp('/mezo/patterns')
    const links = await screen.findAllByRole('link')
    const detail = links.filter((l) => l.getAttribute('href')?.includes('/patterns/'))
    expect(detail.length).toBeGreaterThan(0)
    detail.forEach((l) => expect(l.getAttribute('href')).toMatch(/^\/mezo\/patterns\//))
  })

  test('the legacy /insights paths land on the Mezo pages with the subpath preserved', async () => {
    const router = renderApp('/insights/memoir')
    expect(await screen.findByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/mezo/memoir')
  })
})
