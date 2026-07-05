import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { FuelStackPage } from '@/features/fuel/pages/FuelStackPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

const renderView = () => render(
  <QueryWrapper><MemoryRouter><FuelStackPage /></MemoryRouter></QueryWrapper>,
)

afterEach(() => vi.unstubAllEnvs())

test('renders context, active stack and generated timing', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'AI builder' })).toBeInTheDocument()
  expect(screen.getByText(/AI-generált timing/)).toBeInTheDocument()
})

test('Hozzáadás opens the stack picker', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Hozzáadás' }))
  expect(await screen.findByText('Mit szedjünk')).toBeInTheDocument()
})

test('Bekapcsolás shows the applied toast with the version returned by applyProtocol', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderView()
  // Toast only renders after applyProtocol resolves — the mock mutation is async-but-immediate,
  // so this must await (seed v3 → the returned v4).
  await userEvent.click(screen.getByRole('button', { name: /Bekapcsolás/ }))
  expect(await screen.findByText('Protokoll · v4 aktív')).toBeInTheDocument()
})

test('Mentés protokollként is a deferred CTA (disabled + hamarosan)', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderView()
  const save = screen.getByRole('button', { name: /Mentés protokollként/ })
  expect(save).toBeDisabled()
  expect(save).toHaveTextContent('hamarosan')
})

test('tapping a slot item toggles its intake (log when empty, undo when taken)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderView()
  // Magnézium starts un-taken → tapping logs the intake → the trailing check icon appears.
  const mg = screen.getByRole('button', { name: 'Magnézium-glicinát bevétel' })
  expect(mg.querySelector('svg')).toBeNull()
  await userEvent.click(mg)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Magnézium-glicinát bevétel' }).querySelector('svg')).not.toBeNull(),
  )
  // Kreatin starts taken → tapping undoes the intake → the check icon disappears.
  const kr = screen.getByRole('button', { name: 'Kreatin bevétel' })
  expect(kr.querySelector('svg')).not.toBeNull()
  await userEvent.click(kr)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Kreatin bevétel' }).querySelector('svg')).toBeNull(),
  )
})

test('hides the "Mit nézek most" context card in real mode — seed meso/reta/load cells were fiction (mezo-t16y.4)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  await screen.findByRole('heading', { name: 'AI builder' })
  expect(screen.queryByText('Mit nézek most')).not.toBeInTheDocument()
})

test('shows the "Mit nézek most" demo context card in mock mode', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderView()
  expect(screen.getByText('Mit nézek most')).toBeInTheDocument()
})

test('hides the recommendations section when the backend has none (real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  await screen.findByRole('heading', { name: 'AI builder' })
  expect(screen.queryByText('Mit hozzáadnék')).not.toBeInTheDocument()
})

test('does not fetch /api/goals when rendering the Stack (mezo-4nu, real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let goalsCalls = 0
  server.use(
    http.get(`${API_BASE}/api/goals`, () => {
      goalsCalls++
      return HttpResponse.json([])
    }),
  )
  renderView()
  await screen.findByRole('heading', { name: 'AI builder' })
  // give any mount-time queries a chance to fire before asserting the counter stayed at 0
  await waitFor(() => expect(screen.getByText(/AI-generált timing/)).toBeInTheDocument())
  expect(goalsCalls).toBe(0)
})
