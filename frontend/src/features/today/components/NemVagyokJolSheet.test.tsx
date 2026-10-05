import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { NemVagyokJolSheet } from '@/features/today/components/NemVagyokJolSheet'
import { RECOVERY_QUERY_KEY } from '@/data/train/recoveryHooks'
import type { RecoveryState } from '@/data/train/recoveryApi'
import { localDateString } from '@/shared/lib/dates'

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <ToastProvider><NemVagyokJolSheet onClose={onClose} /></ToastProvider>
    </QueryClientProvider>,
  )
  const cache = () => client.getQueryData<RecoveryState>([...RECOVERY_QUERY_KEY, localDateString()])
  return { onClose, cache }
}

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

it('head, the four serious reasons, the note; no duration row and a disabled CTA before a pick', () => {
  renderSheet()
  expect(screen.getByText('KÍMÉLŐ MÓD')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mi történt?' })).toBeInTheDocument()
  expect(screen.getByText('Szólj, és a napod hozzád igazodik. Nem kell magyarázkodnod.')).toBeInTheDocument()
  const chips = within(screen.getByRole('group', { name: 'Mi történt?' })).getAllByRole('button').map((b) => b.textContent)
  expect(chips).toEqual(['Beteg vagyok', 'Gyomorrontás', 'Sérülés / fájdalom', 'Úton vagyok'])
  expect(screen.queryByText('MEDDIG TARTHAT?')).not.toBeInTheDocument()
  const note = document.querySelector('.nap-kmsheet .trm-whynote')!
  expect(note.textContent).toBe('Amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak. Bármikor befejezheted.')
  expect(note.querySelector('b')?.textContent).toBe('Amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.')
  expect(screen.getByRole('button', { name: 'Kímélő mód bekapcsolása' })).toBeDisabled()
})

it('a pick lights the chip, shows „Meddig tarthat?", and a second tap clears the estimate', () => {
  renderSheet()
  fireEvent.click(screen.getByRole('button', { name: 'Gyomorrontás' }))
  expect(screen.getByRole('button', { name: 'Gyomorrontás' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('MEDDIG TARTHAT?')).toBeInTheDocument()
  expect((document.querySelector('.nap-kmdur') as HTMLElement).style.getPropertyValue('--kc')).toBe('var(--dv-sage)')
  const chip = screen.getByRole('button', { name: '2–3 nap' })
  fireEvent.click(chip)
  expect(chip).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(chip)
  expect(chip).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Kímélő mód bekapcsolása' })).toBeEnabled()
})

it('Kímélő mód bekapcsolása opens the period today with the estimate, toasts and closes', async () => {
  const { onClose, cache } = renderSheet()
  fireEvent.click(screen.getByRole('button', { name: 'Beteg vagyok' }))
  fireEvent.click(screen.getByRole('button', { name: '2–3 nap' }))
  fireEvent.click(screen.getByRole('button', { name: 'Kímélő mód bekapcsolása' }))
  expect(await screen.findByText('Kímélő mód bekapcsolva')).toBeInTheDocument()
  expect(cache()?.period).toMatchObject({ category: 'ILLNESS', estimate: 'FEW_DAYS', startDate: localDateString(), dayIndex: 1 })
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

it('no duration picked → UNKNOWN', async () => {
  const { cache } = renderSheet()
  fireEvent.click(screen.getByRole('button', { name: 'Úton vagyok' }))
  fireEvent.click(screen.getByRole('button', { name: 'Kímélő mód bekapcsolása' }))
  await waitFor(() => expect(cache()?.period).toMatchObject({ category: 'TRAVEL', estimate: 'UNKNOWN' }))
})

it('real mode: a failed write keeps the sheet open with the pick, and no success toast', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.put(`${API_BASE}/api/train/recovery`, () => HttpResponse.json({ messages: [] }, { status: 500 })))
  const { onClose } = renderSheet()
  fireEvent.click(screen.getByRole('button', { name: 'Sérülés / fájdalom' }))
  const cta = screen.getByRole('button', { name: 'Kímélő mód bekapcsolása' })
  fireEvent.click(cta)
  await waitFor(() => expect(cta).toBeEnabled())
  expect(screen.getByRole('heading', { name: 'Mi történt?' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sérülés / fájdalom' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText('Kímélő mód bekapcsolva')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})
