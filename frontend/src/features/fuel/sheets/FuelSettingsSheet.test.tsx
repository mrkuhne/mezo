import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderSheet = (onClose = vi.fn()) => {
  render(<QueryWrapper><FuelSettingsSheet onClose={onClose} /></QueryWrapper>)
  return onClose
}

describe('FuelSettingsSheet', () => {
  test('opens prefilled from the ghost settings', () => {
    renderSheet()
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('4')
    expect(screen.getByLabelText('Koffein-cutoff')).toHaveValue('14:00')
  })

  test('stepper clamps between 3 and 6', async () => {
    renderSheet()
    const minus = screen.getByRole('button', { name: 'Étkezés csökkentése' })
    await userEvent.click(minus)
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('3')
    expect(minus).toBeDisabled()
  })

  test('saving persists the edited values and closes', async () => {
    const onClose = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    fireEvent.change(screen.getByLabelText('Koffein-cutoff'), { target: { value: '13:00' } })
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})

// Real mode: the cold-open prefill race (mezo-53su). The read starts from the ghost
// (4/'14:00') and only flips to the server value after the delayed GET resolves — Save must
// stay disabled until then, the prefill must re-sync to the server value, and a user edit made
// BEFORE the value lands must survive (not be clobbered by the late re-sync).
describe('FuelSettingsSheet — real-mode cold-open prefill', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  const delayServerSettings = () =>
    server.use(
      http.get(`${API_BASE}/api/fuel/settings`, async () => {
        await new Promise((r) => setTimeout(r, 50))
        return HttpResponse.json({ mealsPerDay: 6, caffeineCutoff: '12:00' })
      }),
    )

  test('disables Mentés while loading, then re-syncs the prefill and enables it', async () => {
    delayServerSettings()
    renderSheet()
    // Cold frame: ghost prefill, Save disabled (guards a blind overwrite with the ghost).
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
    // After the server value lands: prefill re-syncs and Save enables.
    await waitFor(() => expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('6'))
    expect(screen.getByLabelText('Koffein-cutoff')).toHaveValue('12:00')
    expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()
  })

  test('a user edit made before the value lands survives the re-sync', async () => {
    delayServerSettings()
    renderSheet()
    // Edit the ghost (4 → 5) before the delayed GET resolves.
    fireEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('5')
    // Let the server value (6) arrive; the touched edit must NOT be overwritten.
    await waitFor(() => expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled())
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('5')
  })
})
