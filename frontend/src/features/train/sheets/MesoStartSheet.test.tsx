import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { localDateString } from '@/shared/lib/dates'

const TPL = 'a10e0000-0000-4000-8000-000000000000'

// Real mode: the start POST is the assertion surface (the sheet owns the mutation).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function setup(onClose = vi.fn()) {
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/mesocycles']}>
        <MesoStartSheet templateId={TPL} title="Upper/Lower Power" onClose={onClose} />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )
  return onClose
}

test('the start date defaults to today and a planned start posts {startDate, status} then closes', async () => {
  let posted: { startDate?: string; status?: string } | null = null
  let postedId: string | null = null
  server.use(
    http.post(`${API_BASE}/api/train/meso-templates/:id/start`, async ({ params, request }) => {
      postedId = String(params.id)
      posted = (await request.json()) as typeof posted
      return HttpResponse.json({
        id: 'f1f3a0e2-0000-4000-8000-000000000001', templateId: postedId,
        title: 'Upper/Lower Power', shortTitle: 'Power', status: posted!.status,
        startDate: posted!.startDate, endDate: posted!.startDate,
        weeks: 5, currentWeek: 0, split: '', style: '', phaseCurve: ['MEV'],
      })
    }),
  )
  const user = userEvent.setup()
  const onClose = setup()

  expect((screen.getByLabelText('Kezdés dátuma') as HTMLInputElement).value).toBe(localDateString())
  await user.click(screen.getByRole('button', { name: 'Tervezett' }))
  await user.click(screen.getByRole('button', { name: /Indítás/ }))

  await waitFor(() => expect(posted).not.toBeNull())
  expect(postedId).toBe(TPL)
  expect(posted).toEqual({ startDate: localDateString(), status: 'planned' })
  await waitFor(() => expect(onClose).toHaveBeenCalled())
  // planned stays put — no jump into the gym week
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles')
})

test('an active start posts status active and lands on the gym week', async () => {
  let posted: { startDate?: string; status?: string } | null = null
  server.use(
    http.post(`${API_BASE}/api/train/meso-templates/:id/start`, async ({ params, request }) => {
      posted = (await request.json()) as typeof posted
      return HttpResponse.json({
        id: 'f1f3a0e2-0000-4000-8000-000000000001', templateId: String(params.id),
        title: 'Upper/Lower Power', shortTitle: 'Power', status: 'active',
        startDate: posted!.startDate, endDate: posted!.startDate,
        weeks: 5, currentWeek: 1, split: '', style: '', phaseCurve: ['MEV'],
      })
    }),
  )
  const user = userEvent.setup()
  setup()

  // 'Aktív' is the default pick — save straight away
  await user.click(screen.getByRole('button', { name: /Indítás/ }))

  await waitFor(() => expect(posted).not.toBeNull())
  expect(posted!.status).toBe('active')
  await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/train/gym'))
})

test('a failed start keeps the sheet open (no false success)', async () => {
  server.use(
    http.post(`${API_BASE}/api/train/meso-templates/:id/start`, () => new HttpResponse(null, { status: 500 })),
  )
  const user = userEvent.setup()
  const onClose = setup()

  await user.click(screen.getByRole('button', { name: /Indítás/ }))

  await waitFor(() => expect(screen.getByRole('button', { name: /Indítás/ })).toBeEnabled())
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles')
})
