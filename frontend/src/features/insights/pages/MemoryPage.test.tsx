import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { MemoryPage } from '@/features/insights/pages/MemoryPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <MemoryPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('MemoryPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the four layer cards with the flow connectors', () => {
    renderPage()
    expect(screen.getByText('L0 · Nyers adat')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
    expect(screen.getByText('/60 nap')).toBeInTheDocument()
    expect(screen.getByText('L1 · Epizodikus napló')).toBeInTheDocument()
    expect(screen.getByText('38 nap-vektor')).toBeInTheDocument()
    expect(screen.getByText('112 chat-vektor')).toBeInTheDocument()
    expect(screen.getByText('L2 · Ítélet-inbox')).toBeInTheDocument()
    expect(screen.getByText('2 függő tényjelölt')).toBeInTheDocument()
    expect(screen.getByText('L3 · Tartós tudás')).toBeInTheDocument()
    expect(screen.getByText('168× megerősítés')).toBeInTheDocument()
    // a konnektorokon EMBERI cron-idők látszanak (nézet-oldali fordítás, mezo-d20.5.7)
    expect(screen.getByText('napi összefoglaló · minden éjjel 02:20')).toBeInTheDocument()
    expect(screen.getByText('minta-felismerés · minden éjjel 02:40')).toBeInTheDocument()
    expect(screen.getByText('hipotézis + tudás-promóció · vasárnap 03:00')).toBeInTheDocument()
  })

  test('the layer cards are glass, each with its own accent (amber→sky→coral→lav) and a 3D icon', () => {
    renderPage()
    const tones = ['amber', 'sky', 'coral', 'lav']
    const icons = ['#t-signal', '#t-journal', '#t-pattern', '#t-brain']
    const eyebrows = ['L0 · Nyers adat', 'L1 · Epizodikus napló', 'L2 · Ítélet-inbox', 'L3 · Tartós tudás']
    eyebrows.forEach((eb, i) => {
      const card = screen.getByText(eb).closest('.mmr-layer') as HTMLElement
      expect(card).toHaveClass('glass', `mmr-t-${tones[i]}`)
      expect(card.style.getPropertyValue('--c')).toBe(`var(--dv-${tones[i]})`)
      // 3D ikon a világító kútban
      expect(card.querySelector('.mmr-well svg.t-ico use')).toHaveAttribute('href', icons[i])
    })
  })

  test('the hero puts the measured days inside the lavender ring, and the active tab is marked', async () => {
    const { container } = renderPage()
    const ring = container.querySelector('.mmr-ring') as HTMLElement
    expect(ring).not.toBeNull()
    expect(ring.querySelector('.uv-ring-prog')).toHaveAttribute('stroke-dasharray', `${(47 / 60) * 100} 100`)
    expect(ring.querySelector('.mz-bignum')).toHaveTextContent('/60')
    expect(screen.getByText('mért nap a minta-ablakban')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Rétegek' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Rétegek' })).toHaveClass('on')
    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }))
    expect(screen.getByRole('tab', { name: 'Audit' })).toHaveClass('on')
    expect(screen.getByRole('tab', { name: 'Rétegek' })).not.toHaveClass('on')
  })

  test('switches to the journal with month separators and embed dots', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Napló' }))
    expect(screen.getByText('2026. augusztus')).toBeInTheDocument()
    expect(screen.getByText('2026. július')).toBeInTheDocument()
    expect(screen.getByText(/Chest Supported Row 3×8-ra ment/)).toBeInTheDocument()
    expect(screen.getAllByLabelText('vektorizálva')).toHaveLength(5)
    expect(screen.getAllByLabelText('még nincs vektor')).toHaveLength(1)
  })

  test('the L1 card opens the journal segment', async () => {
    renderPage()
    await userEvent.click(screen.getByText('L1 · Epizodikus napló'))
    expect(screen.getByText('2026. augusztus')).toBeInTheDocument()
  })

  test('the L1 card opens the journal segment via keyboard (Space)', async () => {
    renderPage()
    const card = screen.getByText('L1 · Epizodikus napló').closest('[role="button"]') as HTMLElement
    card.focus()
    await userEvent.keyboard(' ')
    expect(screen.getByText('2026. augusztus')).toBeInTheDocument()
  })

  test('search is lazy, results jump to the journal entry', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Kereső' }))
    // lusta — még nincs találat, tehát az első seed-nap kivonata sem látszik
    expect(screen.queryByText(/Pihenőnap volt, de a napzárás elmaradt/)).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Hasonló nap keresése'), 'rossz alvás')
    await userEvent.click(screen.getByRole('button', { name: 'Keresés' }))
    expect(await screen.findByText(/Pihenőnap volt, de a napzárás elmaradt/)).toBeInTheDocument()
    // a pontszámok eltűntek (mezo-eq85.10) — a gyűrű csak a rangsor-helyet mutatja
    expect(screen.queryByText(/egyezés/)).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '1. legjobb találat' })).toBeInTheDocument()
    await userEvent.click(screen.getByText(/Pihenőnap volt, de a napzárás elmaradt/))
    // a koppintás a Napló szegmensre vált, a 08-09-es bejegyzés látszik
    expect(await screen.findByText(/a vasárnap esti mintázat megint kirajzolódott/)).toBeInTheDocument()
  })

  test('audit renders cost and links to the canonical fact provenance', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }))
    // 1 · költség-hero
    expect(screen.getByText('$0.125')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Napi LLM token-oszlopok' })).toBeInTheDocument()
    const audit = screen.getByText('$0.125').closest('.mmr-audit') as HTMLElement
    expect(audit).toHaveClass('glass')
    expect(audit.querySelector('.mmr-foot')).toHaveTextContent(/54 hívás\s*bemenet 248\.3k\s*kimenet 38\.7k token/)
    expect(screen.getByRole('link', { name: /Tudástár.*tények és eredetük/ })).toHaveAttribute('href', '/mezo/knowledge?view=tenyek')
    expect(screen.queryByText('×23 megerősítve')).not.toBeInTheDocument()
  })
})

describe('MemoryPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the degraded card on a 404', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/overview`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${API_BASE}/api/companion/memory/summary`, () => new HttpResponse(null, { status: 404 })),
    )
    renderPage()
    expect(await screen.findByText(/A társ memóriája most nem elérhető/)).toBeInTheDocument()
  })

  test('renders an honest error card with retry on a non-404 failure', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/overview`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API_BASE}/api/companion/memory/summary`, () => new HttpResponse(null, { status: 500 })),
    )
    renderPage()
    expect(
      await screen.findByText('Nem sikerült betölteni a memória-rétegeket.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })

  test('renders the honest empty journal state', async () => {
    renderPage()
    expect(await screen.findByText('L0 · Nyers adat')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Napló' }))
    expect(
      await screen.findByText(/Az első éjszakai összefoglaló még nem készült el/),
    ).toBeInTheDocument()
  })

  test('search renders the honest empty state on no match', async () => {
    renderPage()
    await screen.findByText('L0 · Nyers adat')
    await userEvent.click(screen.getByRole('tab', { name: 'Kereső' }))
    await userEvent.type(screen.getByLabelText('Hasonló nap keresése'), 'teljesen egyedi nap')
    await userEvent.click(screen.getByRole('button', { name: 'Keresés' }))
    expect(await screen.findByText('Nincs elég hasonló nap a memóriában.')).toBeInTheDocument()
  })

  // mezo-eq85.10 FIX 3: a failed query must NOT render "Nincs elég hasonló nap a memóriában" —
  // that sentence asserts something about the user's history, and the truth is we could not look.
  test('search renders a failure state, not the empty state, when the query errors', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/similar-days`, () => new HttpResponse(null, { status: 500 })),
    )
    renderPage()
    await screen.findByText('L0 · Nyers adat')
    await userEvent.click(screen.getByRole('tab', { name: 'Kereső' }))
    await userEvent.type(screen.getByLabelText('Hasonló nap keresése'), 'rossz alvás')
    await userEvent.click(screen.getByRole('button', { name: 'Keresés' }))

    expect(await screen.findByText(/A keresés nem sikerült/, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByText('Nincs elég hasonló nap a memóriában.')).not.toBeInTheDocument()
  })

  test('audit shows the honest disabled state when the llm-log switch is off', async () => {
    renderPage()
    await screen.findByText('L0 · Nyers adat')
    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }))
    expect(
      await screen.findByText(/Az LLM-hívás audit-napló ki van kapcsolva/),
    ).toBeInTheDocument()
  })
})
