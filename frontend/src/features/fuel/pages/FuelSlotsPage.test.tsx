import type { ReactNode } from 'react'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { FuelSlotsPage } from '@/features/fuel/pages/FuelSlotsPage'
import { useSlotTemplateActions, useSlotTemplates } from '@/data/hooks'
import type { SlotTemplate } from '@/data/types'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}
const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderPage(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/fuel', '/fuel/slots']} initialIndex={1}>
        <Routes>
          <Route path="/fuel/slots" element={<FuelSlotsPage />} />
          <Route path="/fuel" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SAMPLE: SlotTemplate = {
  dayType: 'rest',
  slots: [
    { label: 'Reggeli', slotKind: 'breakfast', role: 'standard', anchor: { type: 'fixed', time: '07:00' }, budgetPct: 40 },
    { label: 'Ebéd', slotKind: 'lunch', role: 'standard', anchor: { type: 'fixed', time: '13:00' }, budgetPct: 60 },
  ],
}

test('no cached template: shows the recommended preview + a Testreszabás CTA', async () => {
  const qc = newQc()
  renderPage(qc)
  expect(screen.getByRole('tablist', { name: 'Naptípusok' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Pihenőnap' })).toHaveAttribute('aria-selected', 'true')
  expect(await screen.findByRole('button', { name: /Testreszabás/ })).toBeInTheDocument()
  // read-only preview: no editable slot-name inputs yet
  expect(screen.queryByLabelText('Slot neve')).not.toBeInTheDocument()
})

test('Testreszabás forks the recommendation into editable rows; an off-Σ pct shows the sum_pct error and disables Mentés', async () => {
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))

  const nameInputs = await screen.findAllByLabelText('Slot neve')
  expect(nameInputs.length).toBeGreaterThanOrEqual(2)

  // freshly forked rows are normalized to Σ=100 → Mentés starts enabled
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()

  const pctInputs = screen.getAllByLabelText('Budget %') as HTMLInputElement[]
  await userEvent.clear(pctInputs[0])
  await userEvent.type(pctInputs[0], '5')

  expect(await screen.findByRole('alert')).toHaveTextContent('100%')
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
})

test('fork + Mentés saves the template to the cache and navigates back', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useSlotTemplates(), { wrapper })

  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))

  await waitFor(() => expect(result.current.templates.some(t => t.dayType === 'rest')).toBe(true))
  expect(await screen.findByTestId('location')).toHaveTextContent('/fuel')
})

test('an existing template loads straight into the editor with Ajánlott visszaállítása; deleting empties the cache', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => ({ read: useSlotTemplates(), act: useSlotTemplateActions() }), { wrapper })
  await act(() => result.current.act.putTemplate(SAMPLE))

  renderPage(qc)
  expect(await screen.findAllByLabelText('Slot neve')).toHaveLength(2)
  const resetBtn = screen.getByRole('button', { name: 'Ajánlott visszaállítása' })

  await userEvent.click(resetBtn)
  await waitFor(() => expect(result.current.read.templates).toEqual([]))
  expect(screen.queryByRole('button', { name: 'Ajánlott visszaállítása' })).not.toBeInTheDocument()
})

test('real mode: Mentés PUTs the flattened wire body (fixed anchor)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let captured: { dayType: string; body: { slots: Record<string, unknown>[] } } | null = null
  server.use(
    http.put(`${API_BASE}/api/fuel/slot-templates/:dayType`, async ({ params, request }) => {
      const body = (await request.json()) as { slots: Record<string, unknown>[] }
      captured = { dayType: String(params.dayType), body }
      return HttpResponse.json({ dayType: params.dayType, ...body })
    }),
  )
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))

  await waitFor(() => expect(captured).not.toBeNull())
  expect(captured!.dayType).toBe('rest')
  expect(captured!.body.slots.length).toBeGreaterThan(0)
  for (const slot of captured!.body.slots) {
    expect(slot).toEqual(
      expect.objectContaining({ anchorType: 'fixed', time: expect.any(String) }),
    )
    expect(slot).not.toHaveProperty('offsetMin')
  }
})
