import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoReportPage } from '@/features/train/pages/MesoReportPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

const renderAt = (id: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/mesocycles/${id}/report`]}>
        <Routes>
          <Route path="train/mesocycles/:id/report" element={<MesoReportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )

describe('MesoReportPage (mock mode · the meso-rec-03 fixture report)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('heads the page with the run title and its frozen window', () => {
    renderAt('meso-rec-03')
    expect(screen.getByRole('heading', { level: 1, name: 'Recovery rebuild · Tél' })).toBeInTheDocument()
    expect(screen.getByText('Feb 12 → Ápr 23')).toBeInTheDocument()
    expect(screen.getByText('8 hét')).toBeInTheDocument()
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

  it('hides the AI section for a `pending` eval too, while the feature is off', () => {
    renderAt('meso-rec-03')
    // The fixture mirrors the backend (`pending`, feature off) — `pending` must not leak an
    // "Az értékelés készül…" card into an S2 report.
    expect(screen.queryByText(/AI értékelés/)).toBeNull()
    expect(screen.queryByText(/értékelés készül/)).toBeNull()
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

  it('hides the AI section entirely while aiEvalEnabled is false (S2)', () => {
    renderAt('meso-rec-03')
    expect(screen.queryByText(/AI értékelés/)).toBeNull()
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
