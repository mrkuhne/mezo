import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WeeklyWeightCard } from '@/features/me/components/WeeklyWeightCard'
import type { WeekAggregate, DayRow } from '@/features/me/logic/weightStats'
import { QueryWrapper } from '@/test/queryWrapper'
import { API_BASE, diagnosisWeightWireStub } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

const week: WeekAggregate = {
  startIso: '2026-05-18', endIso: '2026-05-24', entries: [], avg: 78.9, low: 78.6, count: 4,
  delta: -0.5, direction: 'down', sparkPoints: [79.4, 78.9, 78.8, 78.6],
}
const rows: DayRow[] = [
  { iso: '2026-05-22', value: 78.6, dod: -0.2 },
  { iso: '2026-05-19', value: 79.4, dod: 0.4 },
]

function renderCard(overrides: Partial<Parameters<typeof WeeklyWeightCard>[0]> = {}) {
  render(
    <MemoryRouter initialEntries={['/mezo/suly']}>
      <Routes>
        <Route path="/mezo/suly" element={
          <WeeklyWeightCard week={week} dayRows={[]} expanded={false} onToggle={() => {}} goalKind="cut" {...overrides} />
        } />
        <Route path="/mezo/diagnozis/:id" element={<span>diagnózis oldal</span>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('WeeklyWeightCard (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('collapsed shows range, avg, delta, direction; toggle fires', () => {
    const onToggle = vi.fn()
    renderCard({ onToggle })
    expect(screen.getByText('Máj 18–24')).toBeInTheDocument()
    expect(screen.getByText('78.9')).toBeInTheDocument()
    expect(screen.getByText('−0.5 kg')).toBeInTheDocument()
    expect(screen.getByText(/lefelé/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Máj 18–24/ }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  test('expanded shows per-day rows', () => {
    renderCard({ dayRows: rows, expanded: true })
    expect(screen.getByText('Máj 22 · Pén')).toBeInTheDocument()
    expect(screen.getByText('−0.2')).toBeInTheDocument()
  })

  test('the diagnose button is the house pill, disabled in mock (costs a real SMART call), with the demo hint', () => {
    renderCard()
    const btn = screen.getByRole('button', { name: '✦ Mi történt ezen a héten?' })
    expect(btn).toHaveClass('mzp-cta')
    expect(btn).toBeDisabled()
    expect(screen.getByText('demo — a kérdezés az élő appban fut')).toBeInTheDocument()
  })
})

describe('WeeklyWeightCard (real mode) — diagnose button', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('hit: an existing anchored report navigates straight there, without generating', async () => {
    let posted = false
    server.use(
      http.get(`${API_BASE}/api/proactive/diagnosis`, () =>
        HttpResponse.json([diagnosisWeightWireStub('2026-05-18', 'existing-report')])),
      http.post(`${API_BASE}/api/proactive/diagnosis`, () => {
        posted = true
        return HttpResponse.json(diagnosisWeightWireStub('2026-05-18'))
      }),
    )
    renderCard()
    const btn = screen.getByRole('button', { name: '✦ Mi történt ezen a héten?' })
    await waitFor(() => expect(btn).toBeEnabled())
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByText(/diagnózis oldal/)).toBeInTheDocument())
    expect(posted).toBe(false)
  })

  test('miss: generates then navigates to the fresh report', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/diagnosis`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/api/proactive/diagnosis`, async ({ request }) => {
        const body = (await request.json()) as { phenomenon: string; anchorStart?: string }
        expect(body).toEqual({ phenomenon: 'weight', anchorStart: '2026-05-18' })
        return HttpResponse.json(diagnosisWeightWireStub('2026-05-18', 'fresh-report'))
      }),
    )
    renderCard()
    const btn = screen.getByRole('button', { name: '✦ Mi történt ezen a héten?' })
    await waitFor(() => expect(btn).toBeEnabled())
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByText(/diagnózis oldal/)).toBeInTheDocument())
  })

  test('409 insufficient weigh-ins renders the inline copy, no navigation', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/diagnosis`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/api/proactive/diagnosis`, () =>
        HttpResponse.json([{ code: 'DIAGNOSIS_INSUFFICIENT_WEIGHINS', message: 'too few' }], { status: 409 })),
    )
    renderCard()
    const btn = screen.getByRole('button', { name: '✦ Mi történt ezen a héten?' })
    await waitFor(() => expect(btn).toBeEnabled())
    fireEvent.click(btn)
    await waitFor(() =>
      expect(screen.getByText('Ehhez a héthez kevés a mérés — legalább 3 reggeli mérés kell.')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/diagnózis oldal/)).not.toBeInTheDocument()
  })
})
