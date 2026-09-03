import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { FuelMedicationPage } from '@/features/fuel/pages/FuelMedicationPage'
import { medicationFixture } from '@/test/fixtures/medication'

// FuelMedicationPage reads useMedication (a dual-mode TanStack query, Task 11).
// Render under a router + QueryClientProvider; both suites drive the populated branch from
// `medicationFixture` · cycleDay 3 (the app itself seeds no medication, mezo-lwmq — mock mode
// preloads the fixture into the cache, real mode overrides the handler with it), so the same
// suite runs green in BOTH modes (mock pin in the outer beforeEach is overridden in the
// real-mode describe).
const renderView = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/fuel/gyogyszer']}>
        <FuelMedicationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

describe('FuelMedicationPage (mock mode)', () => {
  const clientWithFixture = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['medication'], medicationFixture)
    return client
  }

  it('Mozaik scaffold: lav tone page, ‹ Fuel back chip, D{cycleDay} hero, no eyebrow line', () => {
    const { container } = renderView(clientWithFixture())
    expect(container.querySelector('.mz-page.mz-p-lav')).toBeInTheDocument()
    expect(screen.getByText('‹ Fuel')).toBeInTheDocument()
    // De-branded page title (mezo-lwmq): guards against a regression back to "Reta".
    expect(screen.getByText('Gyógyszer')).toBeInTheDocument()
    expect(screen.getByText('D3')).toBeInTheDocument()
  })

  it('renders the medication name + route/cadence/dose card', () => {
    renderView(clientWithFixture())
    expect(screen.getByText('Teszt gyógyszer')).toBeInTheDocument()
    // route + cadence subtitle on the card (mockup: "subQ injekció · heti · hétfő")
    expect(screen.getByText(/subQ injekció · heti · hétfő/)).toBeInTheDocument()
    // the current dose (defaultDose + unit) appears on the card AND the log rows — at least one
    expect(screen.getAllByText('6 mg').length).toBeGreaterThan(0)
  })

  it('shows the cycle bar with the current day (cycleDay 3) outlined in the Stabil phase — peak never red', () => {
    renderView(clientWithFixture())
    const bar = screen.getByRole('list', { name: /ciklus/i })
    // 7 cells, one per cycle day
    const cells = within(bar).getAllByRole('listitem')
    expect(cells).toHaveLength(7)
    // the current cell is day 3 (aria-current) and labelled as the stable phase
    const current = cells.find((c) => c.getAttribute('aria-current') === 'true')!
    expect(current).toBeTruthy()
    expect(within(current).getByText('3')).toBeInTheDocument()
    // peak-phase cells (days 1–2) carry the terracotta `peak` class, never `error`/red
    const peakCells = cells.filter((c) => c.className.includes('peak'))
    expect(peakCells).toHaveLength(2)
    expect(cells.some((c) => /error/i.test(c.className))).toBe(false)
  })

  it('shows the phase note naming the day + Stabil phase', () => {
    renderView(clientWithFixture())
    const note = screen.getByTestId('medication-phase-note')
    expect(note.textContent).toMatch(/3\.\s*nap/)
    expect(note.textContent).toMatch(/Stabil/)
  })

  it('lists the 3 fixture doses in the Beadások log, newest first, with notes surfaced', () => {
    renderView(clientWithFixture())
    const log = screen.getByRole('list', { name: /beadások/i })
    const rows = within(log).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    // newest dose (2026-06-22) is the first row, and its note is now shown (audit gap #10)
    expect(rows[0].textContent).toMatch(/Jún 22/)
    expect(rows[0].textContent).toMatch(/Hétfő reggel · subQ has/)
    // oldest dose (2026-06-08) is the last row, no note
    expect(rows[2].textContent).toMatch(/Jún 8/)
  })

  it('has a "＋ Beadás" button that opens the LogDoseSheet on click', () => {
    renderView(clientWithFixture())
    const btn = screen.getByRole('button', { name: /Beadás/ })
    expect(btn).toBeInTheDocument()
    // the sheet is closed until tapped
    expect(screen.queryByLabelText(/dózis/i)).not.toBeInTheDocument()
    fireEvent.click(btn)
    // tapping flips logOpen → the LogDoseSheet mounts (its dose field is now present)
    expect(screen.getByLabelText(/dózis/i)).toBeInTheDocument()
  })
})

describe('FuelMedicationPage (real mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
  })
  afterEach(() => vi.unstubAllEnvs())

  it('renders the medication + cycle + 3 doses from the overridden API handler', async () => {
    renderView(new QueryClient({ defaultOptions: { queries: { retry: false } } }))
    expect(await screen.findByText('Teszt gyógyszer')).toBeInTheDocument()
    const note = await screen.findByTestId('medication-phase-note')
    expect(note.textContent).toMatch(/Stabil/)
    const log = screen.getByRole('list', { name: /beadások/i })
    expect(within(log).getAllByRole('listitem')).toHaveLength(3)
  })
})

describe('FuelMedicationPage (nincs aktív gyógyszer)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('üres állapotot mutat (nincs hero, nincs bignum), és nincs "＋ Beadás" akció', async () => {
    server.use(http.get(`${API_BASE}/api/medication`, () =>
      HttpResponse.json({
        medication: {
          id: '', name: '', activeIngredient: '', route: '', cadence: '',
          defaultDose: 0, doseUnit: '', active: false,
          cycle: { cycleLengthDays: 0, phases: [] },
        },
        cycle: { cycleDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: [] },
        recentDoses: [],
      })))
    const { container } = renderView(new QueryClient({ defaultOptions: { queries: { retry: false } } }))
    expect(await screen.findByTestId('medication-empty')).toBeInTheDocument()
    expect(screen.getByText('Nincs követett gyógyszer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Beadás$/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('medication-phase-note')).not.toBeInTheDocument()
    expect(container.querySelector('.mz-page-hero')).not.toBeInTheDocument()
    // Fidelity audit (mezo-d20.11): /fuel/gyogyszer measured as "no entrance choreography"
    // because the empty branch — the only one the seeded day ever reaches — rendered outside
    // any EntranceGroup. The honest empty card rises too now.
    expect(container.querySelector('.mz-play [data-testid="medication-empty"].rise')).not.toBeNull()
  })

  it('F7.3: az üres állapot már nem zsákutca — a "＋ Gyógyszer felvétele" CTA a create sheetet nyitja', async () => {
    server.use(http.get(`${API_BASE}/api/medication`, () =>
      HttpResponse.json({ medication: null, cycle: null, recentDoses: [] })))
    renderView(new QueryClient({ defaultOptions: { queries: { retry: false } } }))
    const cta = await screen.findByRole('button', { name: /Gyógyszer felvétele/ })
    fireEvent.click(cta)
    expect(await screen.findByText('Gyógyszer felvétele', { selector: '#medication-form-title *' })).toBeInTheDocument()
  })
})

describe('FuelMedicationPage (F7.3 · szerkesztés + leállítás)', () => {
  const clientWithFixture = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['medication'], medicationFixture)
    return client
  }

  it('a Szerkesztés az edit sheetet nyitja, a mezők a gyógyszerrel előtöltve', () => {
    renderView(clientWithFixture())
    fireEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    expect(screen.getByText('Gyógyszer szerkesztése')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Teszt gyógyszer')).toBeInTheDocument()
  })

  it('a Leállítás kétlépcsős: megerősítő kártya, Mégse visszalép, Leállítom az üres állapotra vált', async () => {
    renderView(clientWithFixture())
    fireEvent.click(screen.getByRole('button', { name: 'Leállítás' }))
    const confirm = screen.getByTestId('medication-stop-confirm')
    expect(confirm.textContent).toMatch(/beadás-történet megmarad/)

    fireEvent.click(within(confirm).getByRole('button', { name: 'Mégse' }))
    expect(screen.queryByTestId('medication-stop-confirm')).not.toBeInTheDocument()
    expect(screen.getByText('Teszt gyógyszer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Leállítás' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leállítom' }))
    // mock stop = the ghost day in the cache -> the honest empty state (mutation is async)
    expect(await screen.findByTestId('medication-empty')).toBeInTheDocument()
  })
})
