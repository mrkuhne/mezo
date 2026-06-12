import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { SportView } from './SportView'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Asserts Phase-1 mock sport data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () => render(<SportView />, { wrapper: QueryWrapper })

test('own page-header: brand eyebrow + PageTitle', () => {
  renderView()
  expect(screen.getByText('Train · Sport')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Röplabda' })).toBeInTheDocument()
})

test('hero shows the venue Display and the RPE explainer', () => {
  renderView()
  expect(screen.getByText('BVSC csarnok')).toBeInTheDocument()
  expect(screen.getByText(/RPE = Rate of Perceived Exertion/)).toBeInTheDocument()
})

test('default view is the weekly plan', () => {
  renderView()
  expect(screen.getByText(/Heti ritmus · 7\.5h court/)).toBeInTheDocument()
})

test('switching to Napló shows the session log header with avg jump count', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  expect(screen.getByText(/avg \d+ ugrás/)).toBeInTheDocument()
})

test('switching to Cross-load shows the read tool chip', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Cross-load' }))
  expect(screen.getByText('get_sport_load')).toBeInTheDocument()
})

test('the + Log header chip opens the SportLogSheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Log/ }))
  expect(await screen.findByText('Sport log · Volleyball')).toBeInTheDocument()
})

// ---- real-mode block: schedule from the DB, editor full-replace ----

test('real mode renders the weekly plan from the schedule endpoint', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  // 5 BVSC fixture slots (msw default) -> derived weekly hours 8 and the Mon row time
  expect(await screen.findByText(/Heti ritmus · 8h court/)).toBeInTheDocument()
  expect(screen.getAllByText(/18:15/).length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'Szerkesztés' })).toBeInTheDocument()
})

test('real mode editor saves the full slot list via PUT', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const put: unknown[] = []
  server.use(
    http.put(`${API_BASE}/api/train/sport-schedule`, async ({ request }) => {
      put.push(await request.json())
      return HttpResponse.json([])
    }),
  )
  renderView()
  await userEvent.click(await screen.findByRole('button', { name: 'Szerkesztés' }))
  expect(await screen.findByRole('heading', { name: 'Heti rend' })).toBeInTheDocument()
  // toggle Csü on (it is off in the BVSC week) and save
  await userEvent.click(screen.getByRole('button', { name: 'Csü session' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(put).toHaveLength(1))
  const slots = put[0] as Array<{ dayOfWeek: number }>
  expect(slots.map((s) => s.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5])
})

test('real mode ghost CTA opens the editor when no schedule exists', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])))
  renderView()
  await userEvent.click(await screen.findByRole('button', { name: /Állítsd be a heti rended/ }))
  expect(await screen.findByRole('heading', { name: 'Heti rend' })).toBeInTheDocument()
})
