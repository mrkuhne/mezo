import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CelPage } from '@/features/me/pages/CelPage'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderGoal = (id = 'lg-kockahas') => render(
  <QueryWrapper>
    <MemoryRouter initialEntries={[`/me/goals/${id}`]}>
      <Routes>
        <Route path="/me/goals/:id" element={<CelPage />} />
        <Route path="/me/goals" element={<div>HUB</div>} />
      </Routes>
    </MemoryRouter>
  </QueryWrapper>,
)

test('renders Kockahas with five pillars, the why quote and two ha–akkor plans, no fabricated numbers', () => {
  renderGoal()
  expect(screen.getByText('Kockahas')).toBeInTheDocument()
  expect(document.querySelectorAll('.lg-pillar')).toHaveLength(5)
  expect(screen.getAllByText(/még nincs adat/)).toHaveLength(5)
  expect(screen.getByText(/Erős, egészséges test/)).toBeInTheDocument()
  expect(screen.getAllByText('HA')).toHaveLength(2)
})

test('Parkolás parks the goal and swaps the action to Aktiválás', async () => {
  renderGoal()
  fireEvent.click(screen.getByRole('button', { name: 'Parkolás' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Aktiválás' })).toBeInTheDocument())
})

test('＋ Pillér is disabled at five pillars', () => {
  renderGoal()
  expect(screen.getByRole('button', { name: '＋ Pillér' })).toBeDisabled()
})

test('unknown id shows the empty state', () => {
  renderGoal('nope')
  expect(screen.getByText('Nincs ilyen cél.')).toBeInTheDocument()
})

// ── Real mode (mezo-iizd.1 final review, item 10) ───────────────────────────────────────────
// Three of the five write endpoints had no MSW handler at all, and setup.ts runs MSW with
// `onUnhandledRequest: 'bypass'` — so a real-mode write test would have escaped to the network
// and passed silently. These tests run against the DEFAULT handlers on purpose, and assert on
// MSW's own `response:mocked` event, which fires only for a request a handler actually served.
describe('real mode (default MSW handlers)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('＋ Pillér writes through PUT /api/life-goals/:id/pillars — served, not bypassed', async () => {
    const served: string[] = []
    const onResponse = ({ request, response }: { request: Request; response: Response }) => {
      served.push(`${request.method} ${new URL(request.url).pathname} ${response.status}`)
    }
    server.events.on('response:mocked', onResponse)
    try {
      // lg-baratno has 3 pillars, so ＋ Pillér is enabled (the 5-pillar cap is not hit).
      renderGoal('lg-baratno')
      await screen.findByText('Az utolsó barátnő')
      await waitFor(() => expect(document.querySelectorAll('.lg-pillar')).toHaveLength(3))

      fireEvent.click(screen.getByRole('button', { name: '＋ Pillér' }))
      // The catalog sheet is fed by GET /api/life-goals/signals (the default handler).
      const chip = await screen.findByRole('button', { name: 'Alváshossz' })
      fireEvent.click(chip)

      await waitFor(() =>
        expect(served).toContain('PUT /api/life-goals/lg-baratno/pillars 200'))
    } finally {
      server.events.removeListener('response:mocked', onResponse)
    }
  })

  // Item 3: a failed list read used to render "Nincs ilyen cél." — a 500 read as a not-found.
  test('a failed list read renders a terminal error + retry, not "Nincs ilyen cél."', async () => {
    let calls = 0
    server.use(http.get(`${API_BASE}/api/life-goals`, () => { calls += 1; return new HttpResponse(null, { status: 500 }) }))
    renderGoal('lg-baratno')
    expect(await screen.findByText('Nem sikerült betölteni a célt.')).toBeInTheDocument()
    expect(screen.queryByText('Nincs ilyen cél.')).not.toBeInTheDocument()
    const before = calls
    fireEvent.click(screen.getByRole('button', { name: 'Újra' }))
    await waitFor(() => expect(calls).toBeGreaterThan(before))
  })

  test('a resolved list with an unknown id still reads "Nincs ilyen cél."', async () => {
    renderGoal('nope')
    expect(await screen.findByText('Nincs ilyen cél.')).toBeInTheDocument()
  })

  test('an unknown id 404s on GET /api/life-goals/:id rather than escaping to the network', async () => {
    const res = await fetch(`${API_BASE}/api/life-goals/nope`)
    expect(res.status).toBe(404)
    const ok = await fetch(`${API_BASE}/api/life-goals/lg-baratno`)
    expect(ok.status).toBe(200)
    expect((await ok.json()).title).toBe('Az utolsó barátnő')
  })

  test('POST /api/life-goals echoes the submitted frame/pillars/ifThenPlans', async () => {
    const res = await fetch(`${API_BASE}/api/life-goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Új', dimension: 'health', startDate: '2026-09-01', frame: 'intrinsic',
        ifThenPlans: [{ ha: 'a', akkor: 'b' }],
        pillars: [{ label: 'Alvás', skillKey: 'recovery', kind: 'average', source: { type: 'metric', key: 'SLEEP_DURATION_H' } }],
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.frame).toBe('intrinsic')
    expect(body.ifThenPlans).toHaveLength(1)
    expect(body.pillars).toHaveLength(1)
    expect(body.pillars[0].position).toBe(0)
    expect(body.pillars[0].id).toBeTruthy()
  })

  test('POST /:id/status resolves by id and stamps closedAt on done', async () => {
    const res = await fetch(`${API_BASE}/api/life-goals/lg-baratno/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'done' }),
    })
    const body = await res.json()
    expect(body.id).toBe('lg-baratno')
    expect(body.status).toBe('done')
    expect(body.closedAt).toBeTruthy()
  })

  test('DELETE /:id answers 204 for a known id and 404 for an unknown one', async () => {
    expect((await fetch(`${API_BASE}/api/life-goals/lg-baratno`, { method: 'DELETE' })).status).toBe(204)
    expect((await fetch(`${API_BASE}/api/life-goals/nope`, { method: 'DELETE' })).status).toBe(404)
  })
})
