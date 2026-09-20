import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import { GoalSettingsPage } from '@/features/me/pages/GoalSettingsPage'

afterEach(() => vi.unstubAllEnvs())
test('mock save updates the saved-target hero immediately and after remount without stale forecasts', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const page = () => render(<QueryClientProvider client={client}><MemoryRouter><GoalSettingsPage /></MemoryRouter></QueryClientProvider>)
  const first = page()
  await userEvent.clear(screen.getByLabelText('Célsúly (kg)'))
  await userEvent.type(screen.getByLabelText('Célsúly (kg)'), '74')
  await userEvent.clear(screen.getByLabelText('Hátralévő céltempó (kg/hét)'))
  await userEvent.type(screen.getByLabelText('Hátralévő céltempó (kg/hét)'), '0.4')
  await userEvent.click(screen.getByRole('button', { name: 'Súlycél mentése' }))
  await screen.findByText('Súlycél mentve.')
  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Cél beállításai áttekintése' })).getByText('74 kg')).toBeInTheDocument())
  expect(screen.getByText('Erővédelem')).toHaveClass('is-on')
  expect(screen.getByText('Még nincs biztos becslés')).toBeInTheDocument()
  first.unmount()
  page()
  expect(within(screen.getByRole('region', { name: 'Cél beállításai áttekintése' })).getByText('74 kg')).toBeInTheDocument()
  expect(screen.getByLabelText('Célsúly (kg)')).toHaveValue(74)
})
