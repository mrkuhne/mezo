import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MedicationFormSheet, DEFAULT_CYCLE } from '@/features/fuel/sheets/MedicationFormSheet'
import { medicationFixture } from '@/test/fixtures/medication'
import type { MedicationDay } from '@/data/types'

// The F7.3 create/edit form sheet (fuel-mely.html). Mock mode: createMedication writes the
// new medication straight into the ['medication'] cache with the honest-zero ghost cycle,
// updateMedication patches the definition in place — both asserted through the cache, the
// same seam the page reads.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderSheet = (client: QueryClient, medication?: MedicationDay['medication']) =>
  render(
    <QueryClientProvider client={client}>
      <MedicationFormSheet medication={medication} onClose={() => {}} />
    </QueryClientProvider>,
  )

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('MedicationFormSheet · create', () => {
  it('a Felveszem addig inaktív, amíg a kötelező mezők üresek', () => {
    renderSheet(newClient())
    expect(screen.getByText('Gyógyszer felvétele')).toBeInTheDocument()
    const save = screen.getByRole('button', { name: /Felveszem/ })
    expect(save).toBeDisabled()
  })

  it('kitöltve a create a cache-be írja az új gyógyszert a 2P·3S·2T sablon-ciklussal és nulla-ciklussal', async () => {
    const client = newClient()
    renderSheet(client)
    fireEvent.change(screen.getByLabelText(/^Név/), { target: { value: 'Retatrutid' } })
    fireEvent.change(screen.getByLabelText(/^Hatóanyag/), { target: { value: 'retatrutid' } })
    fireEvent.change(screen.getByLabelText(/^Dózis/), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: /Felveszem/ }))

    await waitFor(() =>
      expect(client.getQueryData<MedicationDay>(['medication'])?.medication.name).toBe('Retatrutid'))
    const day = client.getQueryData<MedicationDay>(['medication'])
    expect(day?.medication.active).toBe(true)
    expect(day?.medication.cadence).toBe('weekly-monday')
    expect(day?.medication.cycle).toEqual(DEFAULT_CYCLE)
    // No dose yet: the honest-zero cycle, never a fabricated day.
    expect(day?.cycle.cycleDay).toBe(0)
    expect(day?.recentDoses).toEqual([])
  })

  it('napi kadenciára váltva a nap-chipek eltűnnek és a cadence "daily"', async () => {
    const client = newClient()
    renderSheet(client)
    fireEvent.change(screen.getByLabelText(/^Név/), { target: { value: 'D3' } })
    fireEvent.change(screen.getByLabelText(/^Hatóanyag/), { target: { value: 'kolekalciferol' } })
    fireEvent.change(screen.getByLabelText(/^Dózis/), { target: { value: '4000' } })
    fireEvent.click(screen.getByRole('button', { name: 'napi' }))
    expect(screen.queryByRole('group', { name: 'Beadás napja' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Felveszem/ }))
    await waitFor(() =>
      expect(client.getQueryData<MedicationDay>(['medication'])?.medication.cadence).toBe('daily'))
  })
})

describe('MedicationFormSheet · edit', () => {
  it('előtölt, és a Mentés a meglévő ciklus-konfigot érintetlenül viszi tovább', async () => {
    const client = newClient()
    client.setQueryData(['medication'], medicationFixture)
    renderSheet(client, medicationFixture.medication)
    expect(screen.getByText('Gyógyszer szerkesztése')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Teszt gyógyszer')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^Név/), { target: { value: 'Retatrutid 2' } })
    fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))

    await waitFor(() =>
      expect(client.getQueryData<MedicationDay>(['medication'])?.medication.name).toBe('Retatrutid 2'))
    const day = client.getQueryData<MedicationDay>(['medication'])
    expect(day?.medication.cycle).toEqual(medicationFixture.medication.cycle)
    // the dose ledger is untouched by a definition edit
    expect(day?.recentDoses).toEqual(medicationFixture.recentDoses)
  })
})
