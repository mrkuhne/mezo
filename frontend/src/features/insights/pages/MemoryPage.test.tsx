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
    expect(screen.getByText('47/60 nap')).toBeInTheDocument()
    expect(screen.getByText('L1 · Epizodikus napló')).toBeInTheDocument()
    expect(screen.getByText('38 nap-vektor')).toBeInTheDocument()
    expect(screen.getByText('112 chat-vektor')).toBeInTheDocument()
    expect(screen.getByText('L2 · Ítélet-inbox')).toBeInTheDocument()
    expect(screen.getByText('2 függő tényjelölt')).toBeInTheDocument()
    expect(screen.getByText('L3 · Tartós tudás')).toBeInTheDocument()
    expect(screen.getByText('31× megerősítés')).toBeInTheDocument()
    // a konnektorokon a cron-idők látszanak
    expect(screen.getByText('napi összefoglaló · 0 20 2 * * *')).toBeInTheDocument()
    expect(screen.getByText('minta-felismerés · 0 40 2 * * *')).toBeInTheDocument()
    expect(screen.getByText('hipotézis + tudás-promóció · 0 0 3 * * SUN')).toBeInTheDocument()
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
    expect(screen.queryByText('egyezés 0.81')).not.toBeInTheDocument() // lusta — még nincs találat
    await userEvent.type(screen.getByLabelText('Hasonló nap keresése'), 'rossz alvás')
    await userEvent.click(screen.getByRole('button', { name: 'Keresés' }))
    // a matek-chipsor: egyezés × frissesség = végső (0.78/0.81 ≈ 0.96)
    expect(await screen.findByText('egyezés 0.81')).toBeInTheDocument()
    expect(screen.getByText('frissesség 0.96')).toBeInTheDocument()
    expect(screen.getByText('végső 0.78')).toBeInTheDocument()
    await userEvent.click(screen.getByText('egyezés 0.81'))
    // a koppintás a Napló szegmensre vált, a 08-09-es bejegyzés látszik
    expect(await screen.findByText(/a vasárnap esti mintázat megint kirajzolódott/)).toBeInTheDocument()
  })

  test('audit renders the cost hero and the source-grouped provenance', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }))
    // 1 · költség-hero
    expect(screen.getByText('$0.125')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Napi LLM token-oszlopok' })).toBeInTheDocument()
    expect(screen.getByText(/54 hívás · bemenet 248\.3k · kimenet 38\.7k/)).toBeInTheDocument()
    // 2 · forrás-csoportok (a seed elosztása: 12 chat · 1 pattern · 2 manual)
    expect(screen.getByText('Chatből tanulta')).toBeInTheDocument()
    expect(screen.getByText('Mintából promótálva')).toBeInTheDocument()
    expect(screen.getByText('Kézzel rögzítve')).toBeInTheDocument()
    expect(screen.getByText('×23 megerősítve')).toBeInTheDocument() // f2
    expect(screen.getByText('⧉ minta: Késői étkezés ↔ rákövetkező alvásminőség')).toBeInTheDocument()
    expect(screen.getAllByText('még nem erősítette meg újra').length).toBeGreaterThan(0) // null lastReinforcedAt sorok
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

  test('audit shows the honest disabled state when the llm-log switch is off', async () => {
    renderPage()
    await screen.findByText('L0 · Nyers adat')
    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }))
    expect(
      await screen.findByText(/Az LLM-hívás audit-napló ki van kapcsolva/),
    ).toBeInTheDocument()
  })
})
