import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { CharacterCouncilStatus } from '@/features/character/components/CharacterCouncilStatus'
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/data/hooks', () => ({ useCharacterCouncilStatus: () => ({ status: { day: '2026-09-21', status: 'QUIET', sourceThrough: '2026-09-20' }, isLoading: false, isError: false }) }))
test('quiet means the team checked through the source date, not that there is fresh news', () => {
  render(<CharacterCouncilStatus />)
  expect(screen.getByText(/Most nincs új következtetés/)).toBeInTheDocument()
  expect(screen.getByText(/2026.*09.*20/)).toBeInTheDocument()
  expect(screen.queryByText(/új történet/)).not.toBeInTheDocument()
})
