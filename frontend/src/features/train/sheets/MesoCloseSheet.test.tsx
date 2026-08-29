import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoCloseSheet } from '@/features/train/sheets/MesoCloseSheet'
import { MesoReportPage } from '@/features/train/pages/MesoReportPage'
import { useTrain } from '@/data/hooks'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

const MESO = 'b6f3a0e2-0000-4000-8000-0000000000cc'

// Real mode: the close POST (and its optional body) is the assertion surface.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function setup(onClose = vi.fn()) {
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/mesocycles/${MESO}`]}>
        <MesoCloseSheet mesoId={MESO} title="Lifecycle blokk" onClose={onClose} />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )
  return onClose
}

function captureClose(): { body: unknown; ids: string[] } {
  const captured: { body: unknown; ids: string[] } = { body: undefined, ids: [] }
  server.use(
    http.post(`${API_BASE}/api/train/mesocycles/:id/close`, async ({ params, request }) => {
      captured.ids.push(String(params.id))
      captured.body = await request.text()
      return HttpResponse.json({ id: String(params.id), status: 'archived' })
    }),
  )
  return captured
}

test('names the run being closed and explains that the report freezes the close-time state', () => {
  setup()
  expect(screen.getByText(/Lifecycle blokk/)).toBeInTheDocument()
  expect(screen.getByText(/a riport a zárás pillanatának állapotát rögzíti/)).toBeInTheDocument()
})

test('a self-eval note is posted in the close body and the sheet lands on the report', async () => {
  const captured = captureClose()
  const user = userEvent.setup()
  setup()

  await user.type(screen.getByLabelText('Saját értékelés'), 'Jó blokk volt.')
  await user.click(screen.getByRole('button', { name: /Lezárás/ }))

  await waitFor(() => expect(captured.ids).toEqual([MESO]))
  expect(JSON.parse(String(captured.body))).toEqual({ selfEval: 'Jó blokk volt.' })
  await waitFor(() =>
    expect(screen.getByTestId('loc')).toHaveTextContent(`/train/mesocycles/${MESO}/report`),
  )
})

test('closing without a note posts no body (the self-eval is optional)', async () => {
  const captured = captureClose()
  const user = userEvent.setup()
  setup()

  await user.click(screen.getByRole('button', { name: /Lezárás/ }))

  await waitFor(() => expect(captured.ids).toEqual([MESO]))
  expect(captured.body).toBe('')
})

test('a failed close keeps the sheet open and does not navigate (no false success)', async () => {
  server.use(
    http.post(`${API_BASE}/api/train/mesocycles/:id/close`, () => new HttpResponse(null, { status: 500 })),
  )
  const user = userEvent.setup()
  const onClose = setup()

  await user.click(screen.getByRole('button', { name: /Lezárás/ }))

  await waitFor(() => expect(screen.getByRole('button', { name: /Lezárás/ })).toBeEnabled())
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByTestId('loc')).toHaveTextContent(`/train/mesocycles/${MESO}`)
  expect(screen.getByTestId('loc')).not.toHaveTextContent('/report')
})

// --- offline (mock) demo parity: a no-op close would land on a page insisting the run is
// still active, so mock mode emulates BOTH server effects in the client-owned cache.
// The mode is pinned by a NESTED describe's beforeEach (the PatternsPage/ChatPage house
// idiom), NOT by an inline stub inside the test: this file's own beforeEach pins real mode
// for every other case, and an inline override made this mock-only assertion flaky under
// the real-mode suite (CI PR #198).
describe('MesoCloseSheet (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  const MOCK_MESO = 'meso-hyp-04' // the ACTIVE fixture run

  function StatusProbe() {
    const { mesocycles } = useTrain()
    return <div data-testid="status">{mesocycles.find((m) => m.id === MOCK_MESO)?.status}</div>
  }

  test('close archives the run and lands on a report carrying the submitted note', async () => {
    render(
      <QueryWrapper>
        <MemoryRouter initialEntries={[`/train/mesocycles/${MOCK_MESO}`]}>
          <Routes>
            <Route
              path="/train/mesocycles/:id"
              element={
                <MesoCloseSheet mesoId={MOCK_MESO} title="Hypertrophy 04 · Tavasz" onClose={vi.fn()} />
              }
            />
            <Route path="/train/mesocycles/:id/report" element={<MesoReportPage />} />
          </Routes>
          <StatusProbe />
        </MemoryRouter>
      </QueryWrapper>,
    )
    expect(screen.getByTestId('status')).toHaveTextContent('active')

    // `fireEvent.change`, not `user.type`: typing the note is 19 separate async keystrokes,
    // and under full-suite CPU contention the click could read a half-committed `selfEval`
    // (the flake behind CI #198). One synchronous change exercises the same controlled
    // textarea -> closeMesocycle(selfEval) path without racing React's commits.
    fireEvent.change(screen.getByLabelText('Saját értékelés'), {
      target: { value: 'Offline demo zárás.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Lezárás/ }))

    // EVERY post-click assertion is awaited — a synchronous getBy here can lose the race
    // against the navigation + the report render.
    // The run really is archived (the cache write under test)...
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('archived'), { timeout: 3000 })
    // ...the seeded report renders, carrying the note the owner just submitted.
    //
    // `selector: 'p'` + a re-querying waitFor, NOT a bare `findByText`, and the reason is
    // subtle: while the sheet is still mounted, the note ALSO lives in its `<textarea>` —
    // React mirrors a controlled textarea's value into `defaultValue`, which IS the element's
    // text content — so a plain `findByText` can resolve against the TEXTAREA, and by the time
    // the assertion runs the sheet has unmounted and that node is detached ("element could not
    // be found in the document", with the note plainly visible in the DOM). A longer timeout
    // cannot fix it: the find succeeds immediately, on the wrong node. Re-querying for the
    // report's own <p> each attempt is immune to both the collision and the unmount ordering.
    await waitFor(
      () => expect(screen.getByText('Offline demo zárás.', { selector: 'p' })).toBeInTheDocument(),
      { timeout: 3000 },
    )
    // ...titled from the run itself, not from mockClose's last-resort literal...
    expect(
      await screen.findByText('Hypertrophy 04 · Tavasz · riport', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    // ...and nothing claims the run is still going.
    expect(screen.queryByText(/a riport a lezárás pillanatában készül el/)).toBeNull()
  })
})
