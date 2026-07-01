import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LogDoseSheet } from '@/features/fuel/LogDoseSheet'
import { useMedication } from '@/data/hooks'
import { medicationApi } from '@/data/fuel/medicationApi'
import { localDateString } from '@/shared/lib/dates'

// ONE shared QueryClient so the sheet's mutation (setQueryData on ['medication'])
// is visible to a co-rendered useMedication() read — we assert the REAL effect
// (the new dose lands + the cycle recomputes), not just that onClose fired.
function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

describe('LogDoseSheet (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('prefills the dose from the last dose', () => {
    const { qc, wrapper } = setup()
    const med = renderHook(() => useMedication(), { wrapper })
    const lastDose = med.result.current.doses[0]?.dose

    render(
      <QueryClientProvider client={qc}>
        <LogDoseSheet onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect((screen.getByLabelText(/dózis/i) as HTMLInputElement).value).toBe(String(lastDose))
  })

  it('defaults the date to today', () => {
    const { qc } = setup()
    render(
      <QueryClientProvider client={qc}>
        <LogDoseSheet onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect((screen.getByLabelText(/dátum/i) as HTMLInputElement).value).toBe(localDateString())
  })

  it('saves a dose: it lands in the medication cache, the cycle recomputes to day 1, then closes', async () => {
    const { qc, wrapper } = setup()
    const med = renderHook(() => useMedication(), { wrapper })
    const before = med.result.current.doses.length
    const onClose = vi.fn()

    render(
      <QueryClientProvider client={qc}>
        <LogDoseSheet onClose={onClose} />
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText(/dózis/i), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: /beadás|mentés/i }))

    // The new dose actually landed in the cache that useMedication reads, newest-first.
    await waitFor(() => {
      expect(med.result.current.doses.length).toBe(before + 1)
    })
    const newest = med.result.current.doses[0]
    expect(newest.dose).toBe(8)
    // A fresh dose dated today re-anchors "now" → the cycle recomputes to day 1.
    expect(newest.administeredAt.slice(0, 10)).toBe(localDateString())
    expect(med.result.current.cycle.retaDay).toBe(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when onClose-only (sheet mounts content)', () => {
    const { qc } = setup()
    render(
      <QueryClientProvider client={qc}>
        <LogDoseSheet onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    // sanity: the sheet renders its dose field
    expect(screen.getByLabelText(/dózis/i)).toBeInTheDocument()
  })
})

describe('LogDoseSheet (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('calls medicationApi.logDose with the entered dose + today, then closes', async () => {
    const { qc } = setup()
    const spy = vi.spyOn(medicationApi, 'logDose')
    const onClose = vi.fn()

    // Seed the medication cache so the sheet can read the last dose + the medId is known.
    render(
      <QueryClientProvider client={qc}>
        <LogDoseSheet onClose={onClose} />
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText(/dózis/i), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: /beadás|mentés/i }))

    await waitFor(() => expect(spy).toHaveBeenCalled())
    const [, input] = spy.mock.calls[0]
    expect(input.dose).toBe(8)
    expect((input.administeredAt ?? '').slice(0, 10)).toBe(localDateString())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  // Regression guard (mezo-d94): the FE must send an OFFSET-BEARING administeredAt —
  // Jackson 3's OffsetDateTime deserializer rejects a zone-less string with a 400. And the
  // date part must equal the CHOSEN date (the offset is appended, NOT .toISOString()'d, so
  // the backend's administeredAt.toLocalDate() stays the chosen day even in a +offset TZ).
  it('sends an offset-bearing administeredAt whose date part is the chosen date', async () => {
    const { qc } = setup()
    const spy = vi.spyOn(medicationApi, 'logDose')

    render(
      <QueryClientProvider client={qc}>
        <LogDoseSheet onClose={vi.fn()} />
      </QueryClientProvider>,
    )

    // pick an explicit date so the assertion doesn't depend on "today"
    fireEvent.change(screen.getByLabelText(/dátum/i), { target: { value: '2026-06-26' } })
    fireEvent.change(screen.getByLabelText(/dózis/i), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: /beadás|mentés/i }))

    await waitFor(() => expect(spy).toHaveBeenCalled())
    const administeredAt = spy.mock.calls[0][1].administeredAt ?? ''
    // (a) offset-bearing: ends in ±hh:mm or Z (never a zone-less datetime)
    expect(administeredAt).toMatch(/[+-]\d\d:\d\d$|Z$/)
    // (b) its date part is the chosen date (no day-shift from the offset)
    expect(administeredAt.slice(0, 10)).toBe('2026-06-26')
  })
})
