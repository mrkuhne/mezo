import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoCloseSheet } from '@/features/train/sheets/MesoCloseSheet'
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
