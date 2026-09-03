import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoReportPage } from '@/features/train/pages/MesoReportPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="loc">{pathname}</div>
}

const renderAt = (id: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/mesocycles/${id}/report`]}>
        <Routes>
          <Route path="train/mesocycles/:id/report" element={<MesoReportPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )

describe('MesoReportPage (mock mode · the meso-rec-03 fixture report)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('heads the page with the run title and its frozen window', () => {
    renderAt('meso-rec-03')
    expect(screen.getByText('Recovery rebuild · Tél · riport')).toBeInTheDocument()
    expect(screen.getByText('Feb 12 → Ápr 23')).toBeInTheDocument()
    expect(screen.getByText(/8 hét/, { selector: '.mz-hero-sb' })).toBeInTheDocument()
  })

  it('renders the adherence stat strip', () => {
    renderAt('meso-rec-03')
    expect(screen.getByText('21/24')).toBeInTheDocument()
    expect(screen.getByText('8/8')).toBeInTheDocument()
    expect(screen.getByText('88')).toBeInTheDocument()
  })

  it('renders the frozen volume arc behind a muscle switch', async () => {
    const user = userEvent.setup()
    renderAt('meso-rec-03')
    expect(screen.getByTestId('volume-arc-chart')).toBeInTheDocument()
    // chest is first (mrv 16); switching to Hát re-renders the chart for mrv 20
    expect(screen.getByText('MRV 16')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hát' }))
    expect(screen.getByText('MRV 20')).toBeInTheDocument()
  })

  it('does not render the "Ezt akartad" quote when the run has no notes (mezo-d20.15 Task 5)', () => {
    // meso-rec-03's fixture carries a `summary`, but no `notes` — the wizard's goal text.
    renderAt('meso-rec-03')
    expect(screen.queryByTestId('meso-report-quote')).toBeNull()
    expect(screen.queryByText('Ezt akartad')).toBeNull()
  })

  it('renders the per-muscle band card — start → peak / ceiling, sorted by ceiling desc', () => {
    renderAt('meso-rec-03')
    expect(screen.getByText('Izmonként · indulás → elért csúcs / plafon')).toBeInTheDocument()
    const bands = screen.getByTestId('meso-report-bands')
    const rows = within(bands).getAllByTestId('report-band-row')
    expect(rows).toHaveLength(6)
    // Hát (back): mev 8 -> mav/mrv 20, so W1 8, peak reaches the 20 ceiling exactly
    expect(within(rows[0]).getByText('Hát')).toBeInTheDocument()
    expect(within(rows[0]).getByText('8 → 20 / 20')).toBeInTheDocument()
  })

  it('renders the lifestyle context block — totals pills, weekly rows, "–" for missing data', () => {
    renderAt('meso-rec-03')
    const ctx = screen.getByTestId('meso-report-context')
    expect(within(ctx).getByText('Életmód-kontextus')).toBeInTheDocument()
    // totals pills — one per present metric, no invented zeros
    expect(within(ctx).getByText('😴 7,4 h alvás')).toBeInTheDocument()
    expect(within(ctx).getByText('🍽 2429 kcal / 2486 cél')).toBeInTheDocument()
    expect(within(ctx).getByText('⚖️ -1,1 kg')).toBeInTheDocument()
    expect(within(ctx).getByText('🏐 760 perc · 15×')).toBeInTheDocument()
    expect(within(ctx).getByText('🏃 9× futás')).toBeInTheDocument()
    // 8 weekly rows, one per week of the run
    const rows = within(ctx).getAllByTestId('context-week-row')
    expect(rows).toHaveLength(8)
    // The fixture's deliberate null holes — never a fabricated 0 in these cells
    expect(within(rows[2]).getByText('–')).toBeInTheDocument() // W3: no sleep data
    expect(within(rows[4]).getByText('–')).toBeInTheDocument() // W5: fuel logging lapsed
    expect(within(rows[7]).getByText('–')).toBeInTheDocument() // W8: deload, no runs
  })

  it('labels the top-set LOAD move and the e1RM percentage distinctly', () => {
    renderAt('meso-rec-03')
    const strength = screen.getByTestId('meso-report-strength')
    expect(within(strength).getByText('Chest Supported Row')).toBeInTheDocument()
    expect(within(strength).getByText('72,5 → 85 kg · 8 → 8 rep')).toBeInTheDocument()
    expect(within(strength).getByText('+12,5 kg')).toBeInTheDocument()
    expect(within(strength).getByText('+17,2% e1RM')).toBeInTheDocument()
  })

  it('shows the e1RM pill alone when the load did not move but the reps did', () => {
    renderAt('meso-rec-03')
    const strength = screen.getByTestId('meso-report-strength')
    const row = within(strength).getByText('Lateral Raise').closest('[data-testid="strength-row"]')!
    expect(within(row as HTMLElement).getByText('+9,5% e1RM')).toBeInTheDocument()
    expect(within(row as HTMLElement).queryByText(/kg$/)).toBeNull() // 0 kg is not a gain
  })

  it('badges nothing at all on a genuinely flat lift (0 kg AND 0%)', () => {
    renderAt('meso-rec-03')
    const strength = screen.getByTestId('meso-report-strength')
    const row = within(strength).getByText('Leg Press').closest('[data-testid="strength-row"]')!
    expect(within(row as HTMLElement).getByText('120 → 120 kg · 12 → 12 rep')).toBeInTheDocument()
    // a `0% e1RM` badge in a signal colour would invent a verdict where nothing moved
    expect(within(row as HTMLElement).queryByText(/e1RM/)).toBeNull()
    expect(within(row as HTMLElement).queryByText(/kg$/)).toBeNull()
  })

  it('falls back to reps movement on a weightless lift (no e1RM to quote)', () => {
    renderAt('meso-rec-03')
    const strength = screen.getByTestId('meso-report-strength')
    const row = within(strength).getByText('Chin-up').closest('[data-testid="strength-row"]')!
    expect(within(row as HTMLElement).getByText('6 → 10 rep')).toBeInTheDocument()
    expect(within(row as HTMLElement).queryByText(/e1RM/)).toBeNull()
  })

  it('renders the records block with the medal count and the highlights', () => {
    renderAt('meso-rec-03')
    const records = screen.getByTestId('meso-report-records')
    expect(within(records).getByText(/7 medál/)).toBeInTheDocument()
    expect(within(records).getByText('Hammer Curl')).toBeInTheDocument()
    expect(within(records).getByText('Súly-rekord')).toBeInTheDocument()
  })

  it('renders the self-eval read-only', () => {
    renderAt('meso-rec-03')
    expect(screen.getByText('Saját értékelés')).toBeInTheDocument()
    expect(screen.getByText(/jobb váll niggle stabilizálva/)).toBeInTheDocument()
    // read-only: no editor affordance in S2
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('renders the AI ready state — prose paragraphs, generatedAt caption, Újragenerálás', () => {
    renderAt('meso-rec-03')
    const ai = screen.getByTestId('meso-report-ai')
    expect(within(ai).getByText('AI értékelés')).toBeInTheDocument()
    // Split on the blank-line separators (no markdown lib) — the fixture's aiEval has 4.
    expect(ai.querySelectorAll('p')).toHaveLength(4)
    expect(within(ai).getByText(/Recovery rebuild blokk összességében/)).toBeInTheDocument()
    expect(within(ai).getByText(/Generálva · Ápr 23/)).toBeInTheDocument()
    expect(within(ai).getByRole('button', { name: 'Újragenerálás' })).toBeInTheDocument()
  })

  it('says the report is not written yet for a run that is still going', () => {
    renderAt('meso-hyp-04') // the ACTIVE fixture run
    expect(screen.getByText(/a riport a lezárás pillanatában készül el/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Riport generálása' })).toBeNull()
  })

  it('guards an unknown run id', () => {
    renderAt('nope')
    expect(screen.getByText('Ez a futam nem található.')).toBeInTheDocument()
  })

  it('offers Újrafuttatás and opens the shared start sheet', async () => {
    const user = userEvent.setup()
    renderAt('meso-rec-03')
    await user.click(screen.getByRole('button', { name: /Újrafuttatás/ }))
    expect(await screen.findByRole('heading', { name: 'Mikor kezdjük?' })).toBeInTheDocument()
  })

  it('saves the run as a template and lands in the new template editor (mezo-tlwa)', async () => {
    const user = userEvent.setup()
    renderAt('meso-rec-03')
    await user.click(screen.getByRole('button', { name: /Sablon mentése ebből a futamból/ }))
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toMatch(/^\/train\/mesocycles\/templates\/.+/),
    )
  })
})

describe('MesoReportPage (real mode · no report yet)', () => {
  const ID = 'b6f3a0e2-0000-4000-8000-0000000000cc'
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  const archivedMeso = {
    id: ID, title: 'Lifecycle blokk', shortTitle: 'Lifecycle', status: 'archived',
    startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 6,
    split: 'PPL', style: 'RP', phaseCurve: ['MEV'], hasReport: false,
  }
  const report = {
    mesocycleId: ID, templateId: 'a10e0000-0000-4000-8000-000000000000', title: 'Lifecycle blokk',
    startDate: '2026-06-01', endDate: '2026-07-13', closedAt: '2026-07-13T18:00:00Z', weeks: 6,
    selfEval: null, aiEval: null, aiEvalStatus: 'ready', aiEvalGeneratedAt: null, aiEvalEnabled: false,
    adherence: { plannedSessions: 18, completedSessions: 15, plannedWeeks: 6, completedWeeks: 6, completionPct: 83 },
    volume: null, strength: [], records: { medalCount: 0, top: [] }, context: null,
  }

  it('offers Riport generálása, POSTs regenerate and renders the report once it exists', async () => {
    let generated = false
    let posted = 0
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([archivedMeso])),
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () =>
        generated
          ? HttpResponse.json(report)
          : HttpResponse.json([{ code: 'TRAIN_MESO_REPORT_NOT_FOUND', message: 'Nincs riport' }], { status: 404 }),
      ),
      http.post(`${API_BASE}/api/train/mesocycles/:id/report/regenerate`, () => {
        posted += 1
        generated = true
        return new HttpResponse(null, { status: 202 })
      }),
    )
    const user = userEvent.setup()
    renderAt(ID)

    await user.click(await screen.findByRole('button', { name: 'Riport generálása' }))

    await waitFor(() => expect(posted).toBe(1))
    expect(await screen.findByText('15/18')).toBeInTheDocument()
    // the originating template is reachable from the report header
    expect(screen.getByRole('button', { name: /Sablon megnyitása/ })).toBeInTheDocument()
    // this fixture carries neither — both blocks must be ABSENT, not empty
    expect(screen.queryByTestId('meso-report-context')).toBeNull()
    expect(screen.queryByTestId('meso-report-ai')).toBeNull()
  })

  it('renders the "Ezt akartad" quote when the run carries the wizard\'s goal notes (mezo-d20.15 Task 5)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json([{
          ...archivedMeso,
          notes: 'röplabda szezon mellett, a vállam kímélve — de a hát és a váll nagyon jöhet',
          summary: 'a hát elérte a 20 szettet, váll-panasz nélkül zárult a blokk.',
        }]),
      ),
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () => HttpResponse.json(report)),
    )
    renderAt(ID)

    const quote = await screen.findByTestId('meso-report-quote')
    expect(within(quote).getByText('Ezt akartad')).toBeInTheDocument()
    expect(within(quote).getByText(/röplabda szezon mellett/)).toBeInTheDocument()
    expect(within(quote).getByText(/a hát elérte a 20 szettet/)).toBeInTheDocument()
  })

  it('renders a retryable error state on a non-404 read failure (never a blank page)', async () => {
    let broken = true
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([archivedMeso])),
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () =>
        broken ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(report),
      ),
    )
    const user = userEvent.setup()
    renderAt(ID)

    expect(await screen.findByText('Nem sikerült betölteni a riportot.')).toBeInTheDocument()
    // the 404-shaped affordance must NOT appear — a 500 is not "no report yet"
    expect(screen.queryByRole('button', { name: 'Riport generálása' })).toBeNull()

    broken = false
    await user.click(screen.getByRole('button', { name: 'Újrapróbálás' }))

    expect(await screen.findByText('15/18')).toBeInTheDocument()
    expect(screen.queryByText('Nem sikerült betölteni a riportot.')).toBeNull()
  })
})

// The AI block's three live states (mezo-meyc.3) — each posts through the SAME
// `regenerate` mutation the page's bottom "Riport újragenerálása" button uses
// (mesoReportHooks), so a real POST is the meaningful assertion here, not a mock-mode
// cache write.
describe('MesoReportPage (real mode · AI states)', () => {
  const ID = 'b6f3a0e2-0000-4000-8000-0000000000dd'
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  const baseReport = (over: Record<string, unknown> = {}) => ({
    mesocycleId: ID, templateId: null, title: 'AI blokk',
    startDate: '2026-05-01', endDate: '2026-06-26', closedAt: '2026-06-26T18:00:00Z', weeks: 8,
    selfEval: null,
    aiEval: null, aiEvalStatus: 'pending', aiEvalGeneratedAt: null, aiEvalEnabled: true,
    adherence: { plannedSessions: 16, completedSessions: 14, plannedWeeks: 8, completedWeeks: 8, completionPct: 87 },
    volume: null, strength: [], records: { medalCount: 0, top: [] }, context: null,
    ...over,
  })

  it('renders the ready state and POSTs regenerate via Újragenerálás', async () => {
    let posted = 0
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () =>
        HttpResponse.json(baseReport({
          aiEvalStatus: 'ready',
          aiEval: 'Első bekezdés.\n\nMásodik bekezdés.',
          aiEvalGeneratedAt: '2026-06-26T19:00:00Z',
        })),
      ),
      http.post(`${API_BASE}/api/train/mesocycles/:id/report/regenerate`, () => {
        posted += 1
        return new HttpResponse(null, { status: 202 })
      }),
    )
    const user = userEvent.setup()
    renderAt(ID)

    const ai = await screen.findByTestId('meso-report-ai')
    expect(within(ai).getByText('Első bekezdés.')).toBeInTheDocument()
    expect(within(ai).getByText('Második bekezdés.')).toBeInTheDocument()
    expect(within(ai).getByText(/Generálva · Jún 26/)).toBeInTheDocument()

    await user.click(within(ai).getByRole('button', { name: 'Újragenerálás' }))
    await waitFor(() => expect(posted).toBe(1))
  })

  it('renders the failed state and POSTs regenerate via Újrapróbálás', async () => {
    let posted = 0
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () =>
        HttpResponse.json(baseReport({ aiEvalStatus: 'failed' })),
      ),
      http.post(`${API_BASE}/api/train/mesocycles/:id/report/regenerate`, () => {
        posted += 1
        return new HttpResponse(null, { status: 202 })
      }),
    )
    const user = userEvent.setup()
    renderAt(ID)

    const ai = await screen.findByTestId('meso-report-ai')
    expect(within(ai).getByText('Nem sikerült az AI-kiértékelés.')).toBeInTheDocument()

    await user.click(within(ai).getByRole('button', { name: 'Újrapróbálás' }))
    await waitFor(() => expect(posted).toBe(1))
  })

  it('treats a `ready` status with a null aiEval as the failed state (defensive guard)', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () =>
        HttpResponse.json(baseReport({ aiEvalStatus: 'ready', aiEval: null })),
      ),
    )
    renderAt(ID)

    const ai = await screen.findByTestId('meso-report-ai')
    expect(within(ai).getByText('Nem sikerült az AI-kiértékelés.')).toBeInTheDocument()
    expect(within(ai).getByRole('button', { name: 'Újrapróbálás' })).toBeInTheDocument()
  })

  it('hides the AI block entirely while aiEvalEnabled is false, even with a ready eval', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () =>
        HttpResponse.json(baseReport({ aiEvalEnabled: false, aiEvalStatus: 'ready', aiEval: 'x' })),
      ),
    )
    renderAt(ID)

    await screen.findByText('14/16') // wait for the report itself to render
    expect(screen.queryByTestId('meso-report-ai')).toBeNull()
  })
})
