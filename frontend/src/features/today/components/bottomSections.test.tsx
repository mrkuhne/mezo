import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ReactNode } from 'react'
import { QuickStatsRow, ringPct } from '@/features/today/components/QuickStatsRow'
import { QueryWrapper } from '@/test/queryWrapper'

describe('ringPct', () => {
  test('sleep hours map to a fraction of the 8h target', () => {
    expect(ringPct('Alvás', '7.5')).toBeCloseTo(93.75)
  })

  test('missing sleep data ("—") renders an empty ring, not a full one', () => {
    expect(ringPct('Alvás', '—')).toBe(0)
  })

  test('stats with no natural target always render a full "chip" ring', () => {
    expect(ringPct('Súly', '82.5')).toBe(100)
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const renderIn = (ui: ReactNode) =>
  render(<QueryWrapper><MemoryRouter>{ui}</MemoryRouter></QueryWrapper>)

test('QuickStatsRow (mock) shows the three demo stats incl. HRV, each as a mini-ring scard', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { container } = renderIn(<QuickStatsRow />)
  expect(screen.getByText('Alvás')).toBeInTheDocument()
  expect(screen.getByText('Súly')).toBeInTheDocument()
  expect(screen.getByText('HRV')).toBeInTheDocument()
  expect(container.querySelectorAll('.scard')).toHaveLength(3)
  expect(container.querySelectorAll('.scard svg')).toHaveLength(3)
})

test('QuickStatsRow (real) derives sleep + weight and drops the HRV cell', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { container } = renderIn(<QuickStatsRow />)
  // MSW fixtures: one sleep entry (7.5h) + one weight entry (82.5kg).
  await waitFor(() => expect(container.textContent).toContain('7.5'))
  expect(container.textContent).toContain('82.5')
  expect(screen.queryByText('HRV')).not.toBeInTheDocument()
  expect(container.querySelectorAll('.scard svg')).toHaveLength(2)
})
