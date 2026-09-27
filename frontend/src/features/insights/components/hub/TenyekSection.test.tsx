import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { facts as factSeed } from '@/data/insights/knowledge'
import { LINKS, lead, TOAST } from '@/features/insights/logic/hubCopy'
import { onToast } from '@/shared/lib/toastBus'

const renderPage = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <KnowledgeListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="loc-probe">{location.search}</div>
}

const renderPageWithProbe = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <KnowledgeListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

// S6 (mezo-d6ivw.6) B9: the Rólad section runs in the mode the suite was started with — the
// final gate runs it twice (VITE_USE_MOCK unset AND =false), so both paths are covered.
describe(`TenyekSection (${isMockMode() ? 'mock' : 'real'} mode)`, () => {
  test('groups facts by topic (collapsed) and lists muted ones under Elhallgattatott with their reason', async () => {
    renderPage('/?view=tenyek')
    expect(await screen.findByRole('button', { name: /Étkezés ·/ })).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(screen.getByRole('button', { name: /Elhallgattatott ·/ }))
    expect(screen.getByText(/te hallgattattad el/)).toBeInTheDocument() // mock f9
    expect(screen.getByText(/később nem igazolódott/)).toBeInTheDocument() // mock f16
  })

  test('the lead counts the facts, their topics and the on/muted split', async () => {
    renderPage('/?view=tenyek')
    const muted = factSeed.filter((f) => !f.active).length
    const topics = new Set(factSeed.filter((f) => f.active).map((f) => f.category)).size
    expect(await screen.findByText(lead.facts(factSeed.length, topics, factSeed.length - muted, muted))).toBeInTheDocument()
  })

  test('search opens every fold with hits and highlights the match', async () => {
    renderPage('/?view=tenyek')
    await userEvent.type(await screen.findByRole('textbox', { name: 'Keresés a tények között…' }), 'KIFLI')
    expect(screen.getByText('kifli', { selector: 'mark' })).toBeInTheDocument() // f9 is muted
    expect(screen.getByRole('button', { name: /Elhallgattatott ·/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Elhallgattatott ·/ })).toHaveTextContent('1 találat')
    expect(screen.queryByRole('button', { name: /Étkezés ·/ })).toBeNull()
  })

  test('a fold with hits can still be closed during a search', async () => {
    renderPage('/?view=tenyek')
    await userEvent.type(await screen.findByRole('textbox', { name: 'Keresés a tények között…' }), 'caffeine')
    const fold = screen.getByRole('button', { name: /Étkezés ·/ })
    expect(fold).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'false')
  })

  test('a search with no hits anywhere says so and clears', async () => {
    renderPage('/?view=tenyek')
    await userEvent.type(await screen.findByRole('textbox', { name: 'Keresés a tények között…' }), 'zzzz')
    expect(screen.getByText('Nincs találat erre: „zzzz”.')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Keresés törlése' })[0])
    expect(screen.getByRole('button', { name: /Étkezés ·/ })).toBeInTheDocument()
  })

  test('Elhallgattatom mutes the fact, toasts, and it reappears under Elhallgattatott', async () => {
    let body: unknown = null
    server.use(http.patch(`${API_BASE}/api/companion/fact/:id`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({})
    }))
    const toasts: string[] = []
    const off = onToast((t) => { if ('text' in t) toasts.push(t.text) })
    renderPage('/?view=tenyek')
    await userEvent.click(await screen.findByRole('button', { name: /Étkezés ·/ }))
    const row = document.querySelector('[data-row="f:f10"]') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: 'További műveletek' }))
    await userEvent.click(within(row).getByRole('button', { name: /Elhallgattatom/ }))
    off()
    expect(toasts).toEqual([TOAST.muted])
    if (isMockMode()) {
      expect(screen.getByRole('button', { name: /Elhallgattatott ·/ })).toHaveAttribute('aria-expanded', 'true')
      expect(document.querySelector('[data-row="f:f10"]')).toHaveClass('is-muted')
    } else {
      await waitFor(() => expect(body).toMatchObject({ includeInPrompt: false }))
    }
  })

  describe('Elfelejtem', () => {
    beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
    afterEach(() => { vi.useRealTimers() })

    const openStrip = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: /Étkezés ·/ }))
      const row = document.querySelector('[data-row="f:f10"]') as HTMLElement
      await user.click(within(row).getByRole('button', { name: 'További műveletek' }))
      await user.click(within(row).getByRole('button', { name: /Elfelejtem/ }))
    }

    test('hides the row at once and sends exactly one DELETE, only after 5 s', async () => {
      let deletes = 0
      server.use(http.delete(`${API_BASE}/api/companion/fact/:id`, () => { deletes++; return new HttpResponse(null, { status: 204 }) }))
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage('/?view=tenyek')
      await openStrip(user)
      expect(document.querySelector('[data-row="f:f10"]')).toBeNull()
      expect(screen.getByRole('status')).toHaveTextContent('Elfelejtettem: „MyProtein supplement supplier”')
      await act(() => vi.advanceTimersByTimeAsync(4900))
      expect(deletes).toBe(0)
      await act(() => vi.advanceTimersByTimeAsync(200))
      if (!isMockMode()) await waitFor(() => expect(deletes).toBe(1))
      await act(() => vi.advanceTimersByTimeAsync(10_000))
      if (!isMockMode()) expect(deletes).toBe(1)
      expect(screen.queryByRole('status')).toBeNull()
    })

    test('Visszavonom inside the window brings the row back and sends nothing', async () => {
      let deletes = 0
      server.use(http.delete(`${API_BASE}/api/companion/fact/:id`, () => { deletes++; return new HttpResponse(null, { status: 204 }) }))
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage('/?view=tenyek')
      await openStrip(user)
      await user.click(screen.getByRole('button', { name: /Visszavonom/ }))
      expect(document.querySelector('[data-row="f:f10"]')).not.toBeNull()
      await act(() => vi.advanceTimersByTimeAsync(10_000))
      expect(deletes).toBe(0)
    })
  })

  test('the dossier door links to the character dossier', async () => {
    renderPage('/?view=tenyek')
    expect(await screen.findByRole('link', { name: new RegExp(LINKS.dossier) })).toHaveAttribute('href', '/mezo/karakter')
  })

  test('a pattern-sourced fact carries the "észrevételből" tag that opens the observation', async () => {
    renderPageWithProbe('/?view=tenyek')
    await userEvent.click(await screen.findByRole('button', { name: /Étkezés ·/ }))
    await userEvent.click(screen.getByRole('button', { name: /észrevételből/ }))
    expect(screen.getByTestId('loc-probe').textContent).toContain('view=eszrevetelek')
    expect(screen.getByTestId('loc-probe').textContent).toContain('obs=o1')
  })

  test('Honnan tudom? shows the origin and, for a pattern fact, the way to its observation', async () => {
    renderPage('/?view=tenyek')
    await userEvent.click(await screen.findByRole('button', { name: /Étkezés ·/ }))
    const row = document.querySelector('[data-row="f:f8"]') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: /Honnan tudom\?/ }))
    expect(within(row).getByText('HONNAN TUDOM')).toBeInTheDocument()
    expect(within(row).getByText(/Megerősített észrevételből tanultam/)).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: /Az észrevétel, amiből tanultam/ })).toBeInTheDocument()
  })
})
