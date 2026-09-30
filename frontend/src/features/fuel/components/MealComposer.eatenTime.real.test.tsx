import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { MealComposer } from '@/features/fuel/components/MealComposer'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

const windows: FuelSlot[] = [
  { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending', windowFrom: '07:00', windowTo: '10:00' },
  { time: '16:30', kind: 'snack', label: 'Uzsonna', slotKey: 'snack', state: 'pending', windowFrom: '16:00', windowTo: '17:30' },
]

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 30, 14, 10))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

test('real meal action posts the selected day and window; failed POST keeps the draft for retry', async () => {
  const posted: Array<{ slot: string; loggedAt: string; window: { from: string; to: string } | null }> = []
  server.use(http.post(`${API_BASE}/api/meal`, async ({ request }) => {
    posted.push(await request.json() as typeof posted[number])
    if (posted.length === 1) return new HttpResponse(null, { status: 503 })
    return HttpResponse.json({
      id: 'new', slot: 'breakfast', loggedAt: '2026-09-27T09:15:00+02:00', mealDate: '2026-09-27',
      title: 'Teszt', macros: { kcal: 260, p: 20, c: 30, f: 5 }, score: { value: 0.8 }, items: [],
    }, { status: 201 })
  }))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  const onSaved = vi.fn()
  const user = userEvent.setup()
  render(<MealComposer fixedSlot="snack" logDate="2026-09-27" eatingTimeWindows={windows}
    prefill={{ source: 'pantry', pantryItemId: 'ing-zab' }} onSaved={onSaved} onCancel={() => {}} />,
  { wrapper })

  await user.click(screen.getByRole('button', { name: 'Mikor ettél?' }))
  fireEvent.change(screen.getByLabelText('Evés időpontja'), { target: { value: '09:15' } })
  await user.click(screen.getByRole('button', { name: /Logolás/ }))
  await waitFor(() => expect(posted).toHaveLength(1))
  await waitFor(() => expect(screen.getByText('Nem sikerült menteni. Próbáld újra.')).toBeInTheDocument())
  expect(onSaved).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Evés időpontja')).toHaveValue('09:15')
  expect(posted[0]).toMatchObject({ slot: 'breakfast', window: { from: '07:00', to: '10:00' } })
  expect(posted[0].loggedAt).toContain('2026-09-27T09:15')

  await user.click(screen.getByRole('button', { name: /Logolás/ }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  expect(posted).toHaveLength(2)
})
