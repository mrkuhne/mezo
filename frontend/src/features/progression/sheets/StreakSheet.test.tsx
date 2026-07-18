import { render, screen } from '@testing-library/react'
import { StreakSheet } from '@/features/progression/sheets/StreakSheet'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('shows the streak, the next milestone and the saver stock', () => {
  render(
    <QueryWrapper>
      <StreakSheet onClose={() => {}} />
    </QueryWrapper>,
  )
  expect(screen.getByText('🔥 6 napos sorozat')).toBeInTheDocument()
  expect(screen.getByText('Következő mérföldkő: 7 nap — +50 🪙')).toBeInTheDocument()
  expect(screen.getByText(/nálad: 1\/2/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Megveszem' })).toBeEnabled() // 240 ≥ 200
})
