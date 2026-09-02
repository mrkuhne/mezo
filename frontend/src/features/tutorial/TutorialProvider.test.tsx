import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { TutorialProvider, useTutorial } from '@/features/tutorial/TutorialProvider'
import { readLocalProgress, writeLocalProgress } from '@/shared/lib/tutorialSeen'
import { API_BASE } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { server } from '@/test/msw/server'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

function Probe() {
  const t = useTutorial()
  const navigate = useNavigate()
  return (
    <div>
      <span data-testid="current">{t.current?.id ?? '-'}</span>
      <span data-testid="unseen">{String(t.isUnseen('fuel'))}</span>
      <button onClick={() => t.open('fuel')}>nyisd</button>
      <button onClick={() => navigate('/train')}>train</button>
      <button onClick={() => navigate('/fuel')}>fuel</button>
    </div>
  )
}

const renderAt = (path: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <TutorialProvider>
          <Routes><Route path="*" element={<Probe />} /></Routes>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )

const renderAtStrict = (path: string) =>
  render(
    <StrictMode>
      <QueryWrapper>
        <MemoryRouter initialEntries={[path]}>
          <TutorialProvider>
            <Routes><Route path="*" element={<Probe />} /></Routes>
          </TutorialProvider>
        </MemoryRouter>
      </QueryWrapper>
    </StrictMode>,
  )

const flush = () => act(() => { vi.advanceTimersByTime(700) })

test('/fuel első belépésre a késleltetés után felugrik, és a megjelenéskor már látottnak számít', async () => {
  renderAt('/fuel')
  expect(screen.getByTestId('current')).toHaveTextContent('fuel')
  expect(screen.queryByRole('dialog')).toBeNull()
  flush()
  expect(await screen.findByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
  expect(screen.getByTestId('unseen')).toHaveTextContent('false')
  expect(readLocalProgress().fuel?.version).toBe(1)
  expect(readLocalProgress().fuel?.completedAt).toBeNull()
})

test('StrictMode alatt (mount → cleanup → re-run) is felugrik hideg oldalbetöltésre', async () => {
  renderAtStrict('/fuel')
  expect(screen.getByTestId('current')).toHaveTextContent('fuel')
  flush()
  expect(await screen.findByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
})

test('Kihagyom → dismissedAtStep; nem ugrik fel újra ugyanabban a sessionben, sem route-visszatérésre', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  flush()
  await user.click(await screen.findByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Kihagyom' }))
  await act(async () => { vi.advanceTimersByTime(500) })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(readLocalProgress().fuel?.dismissedAtStep).toBe(1)
  await user.click(screen.getByRole('button', { name: 'train' }))
  await user.click(screen.getByRole('button', { name: 'fuel' }))
  flush()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('látott kalauz nem ugrik fel, de a „?" (open) bármikor nyit', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  writeLocalProgress({ fuel: { version: 1, seenAt: '2026-09-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  renderAt('/fuel')
  flush()
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'nyisd' }))
  expect(screen.getByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
})

test('regi verzió látva → az új verzió újra felugrik', async () => {
  writeLocalProgress({ fuel: { version: 0, seenAt: '2026-09-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  renderAt('/fuel')
  flush()
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
})

test('kalauz nélküli route-on nincs felugrás és current null', () => {
  renderAt('/train')
  flush()
  expect(screen.getByTestId('current')).toHaveTextContent('-')
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('a kapcsolat-chip navigál, a kalauz completedAt-tal zár', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  flush()
  await screen.findByRole('dialog')
  await user.click(screen.getByRole('button', { name: '5. kártya' }))
  await user.click(screen.getByRole('button', { name: /^Edzés/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByTestId('current')).toHaveTextContent('-') // /train-en vagyunk
  expect(readLocalProgress().fuel?.completedAt).not.toBeNull()
})

test('route-váltás nyitott, érintetlen kalauzon dismissedAtStep: 0-t ír', async () => {
  renderAt('/fuel')
  flush()
  await screen.findByRole('dialog')
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('button', { name: 'train' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(readLocalProgress().fuel?.dismissedAtStep).toBe(0)
  expect(readLocalProgress().fuel?.completedAt).toBeNull()
})

test('szerver-merge: a szerveren látott másik kalauz beolvad, és a csak-lokális visszaíródik PUT-tal (real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false') // ez a teszt kifejezetten a real-mode útvonalat (GET/PUT MSW-n át) vizsgálja
  if (isMockMode()) return // mock módban a QueryClient hordozza az állapotot, nincs külön szerver-oldal
  let putBody: unknown = null
  server.use(
    http.get(`${API_BASE}/api/tutorial/progress`, () =>
      HttpResponse.json({ progress: { nap: { version: 1, seenAt: '2026-08-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } } }),
    ),
    http.put(`${API_BASE}/api/tutorial/progress`, async ({ request }) => {
      putBody = await request.json()
      return HttpResponse.json({ progress: (putBody as { progress: unknown }).progress })
    }),
  )
  writeLocalProgress({ fuel: { version: 1, seenAt: '2026-09-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  renderAt('/train')
  flush()
  await waitFor(() => {
    const p = readLocalProgress()
    expect(p.nap).toBeDefined()
    expect(p.fuel).toBeDefined()
  })
  await waitFor(() => expect(putBody).not.toBeNull())
  expect((putBody as { progress: Record<string, unknown> }).progress).toHaveProperty('nap')
  expect((putBody as { progress: Record<string, unknown> }).progress).toHaveProperty('fuel')
  expect(screen.queryByRole('dialog')).toBeNull() // /train-en nincs kalauz, és a fuel amúgy is látott
})

test('PUT-hiba esetén a lokális írás (seenAt) marad az igazság, a sheet nem törik (real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false') // ez a teszt kifejezetten a real-mode PUT-hiba útvonalat vizsgálja
  if (isMockMode()) return
  server.use(http.put(`${API_BASE}/api/tutorial/progress`, () => HttpResponse.json({}, { status: 500 })))
  renderAt('/fuel')
  flush()
  await screen.findByRole('dialog', { name: 'Kalauz · Fuel' })
  await waitFor(() => expect(readLocalProgress().fuel).toBeDefined())
  expect(readLocalProgress().fuel?.version).toBe(1)
  expect(screen.getByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
})
