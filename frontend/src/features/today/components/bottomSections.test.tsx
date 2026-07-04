import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactNode } from 'react'
import { QuickStatsRow } from '@/features/today/components/QuickStatsRow'
import { InsightsTeaser } from '@/features/today/components/InsightsTeaser'
import { QueryWrapper } from '@/test/queryWrapper'

afterEach(() => {
  vi.unstubAllEnvs()
})

const renderIn = (ui: ReactNode) =>
  render(<QueryWrapper><MemoryRouter>{ui}</MemoryRouter></QueryWrapper>)

test('QuickStatsRow (mock) shows the three demo stats incl. HRV', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderIn(<QuickStatsRow />)
  expect(screen.getByText('Alvás')).toBeInTheDocument()
  expect(screen.getByText('Súly')).toBeInTheDocument()
  expect(screen.getByText('HRV')).toBeInTheDocument()
})

test('QuickStatsRow (real) derives sleep + weight and drops the HRV cell', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { container } = renderIn(<QuickStatsRow />)
  // MSW fixtures: one sleep entry (7.5h) + one weight entry (82.5kg).
  await waitFor(() => expect(container.textContent).toContain('7.5'))
  expect(container.textContent).toContain('82.5')
  expect(screen.queryByText('HRV')).not.toBeInTheDocument()
})

test('InsightsTeaser (mock) shows the demo pattern + link chip', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderIn(<InsightsTeaser />)
  expect(screen.getByText(/Új minta/)).toBeInTheDocument()
  expect(screen.getByText('Insights → Patterns')).toBeInTheDocument()
})

test('InsightsTeaser (real) surfaces the top proposed pattern from the API', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderIn(<InsightsTeaser />)
  // Hidden during the cold-load window, then the MSW pattern fixture lands.
  await waitFor(() => expect(screen.getByText(/Új minta · 0.85 konfidencia/)).toBeInTheDocument())
  expect(screen.getByText('Reta beadás + 36h ablakban étvágy lefulladás')).toBeInTheDocument()
})
