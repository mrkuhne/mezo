import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelKonyhaPage } from '@/features/fuel/pages/FuelKonyhaPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('a Konyha oldal a saját címével jelenik meg', () => {
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/konyha']}>
        <FuelKonyhaPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(screen.getByRole('heading', { name: 'Konyha' })).toBeInTheDocument()
})
