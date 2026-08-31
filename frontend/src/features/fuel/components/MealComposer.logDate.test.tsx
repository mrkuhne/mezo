// MealComposer.logDate.test.tsx — a logDate/logTime dátumozott mentése (mezo-1j3z).
// Mock mód, minden hook valódi; a composer közvetlenül renderelve. A cache-visszaolvasós
// technika a LogFlowPage.prefill.test.tsx mintáját követi: EGY közös QueryClient a composer +
// a probe-hook alá (a QueryWrapper helper minden hívásra ÚJ klienst mintázna, azt itt nem
// szabad használni, mert a composer és a probe akkor külön cache-ben élne).
import type { ReactNode } from 'react'
import { render, screen, renderHook, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useFuelDay } from '@/data/hooks'
import { MealComposer } from './MealComposer'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

test('logDate + logTime: a mentett meal loggedAt-ja a választott nap + idő, a cache a napra kulcsolt', async () => {
  const { wrapper } = setup()
  const user = userEvent.setup()
  render(
    <MealComposer fixedSlot="lunch" logDate="2026-05-19" logTime="13:00"
      prefill={null} onSaved={() => {}} onCancel={() => {}} />,
    { wrapper },
  )
  // egy kamra-tétel hozzáadása a meglévő picker-úton (Kamra forrás-csempe → első tétel „…
  // hozzáadása” gombja → Bezárás), majd mentés.
  await user.click(screen.getByRole('button', { name: 'Kamra · hozzáadás' }))
  const addBtn = (await screen.findAllByRole('button', { name: /hozzáadása$/i }))[0]
  await user.click(addBtn)
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  await user.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))

  const probe = renderHook(() => useFuelDay('2026-05-19'), { wrapper })
  await waitFor(() => {
    const meals = probe.result.current.fuel.meals
    expect(meals.some(m => m.loggedAt?.startsWith('2026-05-19T13:00'))).toBe(true)
  })
})

test('logDate logTime NÉLKÜL (szabad blokk, slot választva): a loggedAt a slot SLOT_DEFAULT_TIME-jára esik', async () => {
  const { wrapper } = setup()
  const user = userEvent.setup()
  render(
    <MealComposer logDate="2026-05-19"
      prefill={null} onSaved={() => {}} onCancel={() => {}} />,
    { wrapper },
  )
  // MIKOR segment is visible (no fixedSlot) — pin the slot explicitly to lunch (13:00 default).
  await user.click(screen.getByRole('button', { name: 'Ebéd' }))
  await user.click(screen.getByRole('button', { name: 'Kamra · hozzáadás' }))
  const addBtn = (await screen.findAllByRole('button', { name: /hozzáadása$/i }))[0]
  await user.click(addBtn)
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  await user.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))

  const probe = renderHook(() => useFuelDay('2026-05-19'), { wrapper })
  await waitFor(() => {
    const meals = probe.result.current.fuel.meals
    expect(meals.some(m => m.loggedAt?.startsWith('2026-05-19T13:00'))).toBe(true)
  })
})

test('saveLabel felülírja a mentés-CTA feliratát', () => {
  const { wrapper } = setup()
  render(
    <MealComposer fixedSlot="lunch" saveLabel="✓ Pótlás · aug 30."
      prefill={null} onSaved={() => {}} onCancel={() => {}} />,
    { wrapper },
  )
  expect(screen.getByRole('button', { name: '✓ Pótlás · aug 30.' })).toBeInTheDocument()
})
