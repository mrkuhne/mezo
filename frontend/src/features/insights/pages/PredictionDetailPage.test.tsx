import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { http, HttpResponse, delay } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { PredictionDetailPage } from '@/features/insights/pages/PredictionDetailPage'
import { ExperimentDetailPage } from '@/features/insights/pages/ExperimentDetailPage'
import { PredictionsPage } from '@/features/insights/pages/PredictionsPage'

const prediction = { id: 'p1', title: 'Alvás javul', basis: 'Korábbi lefekvés.', confidence: null, metricKey: 'sleep_avg', expectedDirection: 'up', validFrom: '2026-07-01', validTo: '2026-07-07', status: 'missed', actual: '6 óra', generatedAt: '2026-07-01T06:00:00Z' }
const experiment = { id: 'e1', title: 'Esti séta', hypothesis: 'A séta javítja az alvást.', status: 'proposed', metricKey: 'sleep_avg', expectedDirection: 'up', startDate: null, totalDays: 7, generatedAt: '2026-07-01T06:00:00Z' }
function show(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/mezo/predictions" element={<PredictionsPage />} />
    <Route path="/mezo/predictions/:id" element={<PredictionDetailPage />} />
    <Route path="/mezo/experiments/:id" element={<ExperimentDetailPage />} />
    <Route path="/mezo/experiments" element={<p>Kísérletlista</p>} />
  </Routes></MemoryRouter>, { wrapper: QueryWrapper })
}
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())
test('missed forecast list links to its full page without claiming success', async () => {
  server.use(http.get(`${API_BASE}/api/proactive/prediction`, () => HttpResponse.json([prediction])))
  show('/mezo/predictions')
  const detailLink = await screen.findByRole('link', { name: 'Alvás javul' })
  expect(screen.getByText('Megfigyelt eredmény: 6 óra')).toBeInTheDocument()
  expect(screen.queryByText(/Bejött:/)).not.toBeInTheDocument()
  await userEvent.click(detailLink)
  expect(await screen.findByText('Alvás javul')).toBeInTheDocument()
  expect(screen.getByText('Megfigyelt eredmény: 6 óra')).toBeInTheDocument()
  expect(screen.queryByText(/Bejött:/)).not.toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Visszajelzés az előrejelzésről' })).toBeInTheDocument()
})
test('deep link distinguishes pending, fetch failure and a missing record', async () => {
  server.use(http.get(`${API_BASE}/api/proactive/prediction`, async () => { await delay(30); return new HttpResponse(null, { status: 500 }) }))
  show('/mezo/predictions/missing')
  expect(screen.getByRole('status')).toHaveTextContent('Betöltés')
  expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült')
  server.use(http.get(`${API_BASE}/api/proactive/prediction`, () => HttpResponse.json([])))
  await userEvent.click(screen.getByRole('button', { name: 'Újrapróbálom' }))
  expect(await screen.findByText('Ez az előrejelzés nem található.')).toBeInTheDocument()
})
test.each(['Elfogadom', 'Elvetem'])('experiment detail preserves %s mutation with the record id', async (label) => {
  server.use(http.get(`${API_BASE}/api/proactive/experiment`, () => HttpResponse.json([experiment])))
  const writes: unknown[] = []
  server.use(http.post(`${API_BASE}/api/proactive/experiment/:id/decision`, async ({ params, request }) => {
    writes.push({ id: params.id, ...await request.json() as object }); return HttpResponse.json(experiment)
  }))
  show('/mezo/experiments/e1')
  await userEvent.click(await screen.findByRole('button', { name: label }))
  await waitFor(() => expect(writes).toEqual([{ id: 'e1', decision: label === 'Elfogadom' ? 'accept' : 'dismiss' }]))
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(screen.getByText('Kísérletlista')).toBeInTheDocument()
})
test('missing experiment retains parent navigation and has no decision controls', async () => {
  show('/mezo/experiments/missing')
  expect(await screen.findByText('Ez a kísérlet nem található.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Elfogadom' })).not.toBeInTheDocument()
})
test('prediction filters retain the selected state when returning from a detail', async () => {
  server.use(http.get(`${API_BASE}/api/proactive/prediction`, () => HttpResponse.json([prediction, { ...prediction, id: 'p2', title: 'Függő jóslat', status: 'pending', actual: null }])))
  show('/mezo/predictions')
  await screen.findByText('Függő jóslat')
  await userEvent.click(screen.getByRole('button', { name: 'Lezárt' }))
  expect(screen.queryByText('Függő jóslat')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Alvás javul' }))
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(screen.getByRole('button', { name: 'Lezárt' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText('Függő jóslat')).not.toBeInTheDocument()
})

// Üvegesítés U8a (mezo-me75u.13): ONE glass hero; pending = expectation + confidence ring,
// resolved = „Ezt vártam — és ez történt"; back returns to where the user came from.
test('a pending forecast wears one glass hero with the confidence ring and asks what happened below', async () => {
  server.use(http.get(`${API_BASE}/api/proactive/prediction`, () => HttpResponse.json([{ ...prediction, status: 'pending', actual: null, confidence: 0.64 }])))
  show('/mezo/predictions/p1')
  expect(await screen.findByRole('heading', { name: 'Mennyire biztos benne Boop?' })).toBeInTheDocument()
  const glass = document.querySelectorAll('.glass:not(.uv-back)')
  expect(glass).toHaveLength(1)
  expect(glass[0]).toHaveClass('pdt-hero')
  expect(document.querySelector('.pdt-ring-n')?.textContent).toBe('64%')
  expect(screen.getByText('Mi történt?')).toBeInTheDocument()
  expect(screen.queryByText('Ezt vártam')).not.toBeInTheDocument()
})
test('a resolved forecast shows what was expected against what happened inside the hero', async () => {
  server.use(http.get(`${API_BASE}/api/proactive/prediction`, () => HttpResponse.json([prediction])))
  show('/mezo/predictions/p1')
  expect(await screen.findByText('Ezt vártam')).toBeInTheDocument()
  expect(screen.getByText('Alvás javul.')).toBeInTheDocument()
  expect(screen.getByText('Megfigyelt eredmény: 6 óra').closest('.pdt-hero')).not.toBeNull()
  expect(screen.queryByText('Mi történt?')).not.toBeInTheDocument()
  expect(document.querySelectorAll('.glass:not(.uv-back)')).toHaveLength(1)
})
test('from the list the back pill says Vissza and pops to the list', async () => {
  server.use(http.get(`${API_BASE}/api/proactive/prediction`, () => HttpResponse.json([prediction])))
  show('/mezo/predictions')
  await userEvent.click(await screen.findByRole('link', { name: 'Alvás javul' }))
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent(/‹\s*Vissza/)
})
test('an active experiment hero shows where we are: day ring and one cell per day', async () => {
  server.use(http.get(`${API_BASE}/api/proactive/experiment`, () => HttpResponse.json([{ ...experiment, status: 'active', startDate: '2026-07-01' }])))
  show('/mezo/experiments/e1')
  expect(await screen.findByRole('heading', { name: 'Hol tartunk?' })).toBeInTheDocument()
  expect(document.querySelectorAll('.glass:not(.uv-back)')).toHaveLength(1)
  expect(document.querySelectorAll('.pdt-dcells span')).toHaveLength(7)
  expect(screen.queryByRole('group', { name: 'Döntés a kísérletről' })).not.toBeInTheDocument()
})
