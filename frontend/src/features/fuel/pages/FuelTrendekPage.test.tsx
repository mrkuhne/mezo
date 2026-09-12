import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelTrendekPage } from '@/features/fuel/pages/FuelTrendekPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('a Trendek oldal a saját címével jelenik meg', () => {
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/trendek']}>
        <FuelTrendekPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(screen.getByRole('heading', { name: 'Trendek' })).toBeInTheDocument()
})
