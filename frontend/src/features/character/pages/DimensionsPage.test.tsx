// DimensionsPage — the flat 8-tile list (mezo-1gim.13, Task 4). Mode-agnostic via the
// KarakterHubPage.test.tsx hook-override idiom.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DimensionsPage } from './DimensionsPage'
import { MOCK_OVERVIEW } from '@/data/character/characterMock'
import type { CharacterOverviewResponse } from '@/data/character/characterApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const hoisted = vi.hoisted(() => ({ overview: null as unknown as CharacterOverviewResponse | null }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useCharacterOverview: () => ({ overview: hoisted.overview, isLoading: false }) }
})

beforeEach(() => {
  hoisted.overview = MOCK_OVERVIEW
  mockNavigate.mockReset()
})

describe('DimensionsPage', () => {
  test('renders all 9 dimension tiles (7 CORE + 1 META + 1 CHAPTER)', () => {
    render(<DimensionsPage />)
    expect(screen.getAllByRole('button', { name: MOCK_OVERVIEW.dimensions[0].title }).length).toBeGreaterThan(0)
    MOCK_OVERVIEW.dimensions.forEach((d) => {
      expect(screen.getByRole('button', { name: d.title })).toBeInTheDocument()
    })
  })

  test('the CHAPTER dimension gets the dashed chapter styling', () => {
    const { container } = render(<DimensionsPage />)
    const chapterTile = screen.getByRole('button', { name: 'Munka-stressz ciklus' })
    expect(chapterTile).toHaveClass('chapter')
    expect(container.querySelectorAll('.kr-dimtile.chapter')).toHaveLength(1)
  })

  test('the META dimension gets the solid meta styling, not the dashed chapter one', () => {
    const { container } = render(<DimensionsPage />)
    const metaTile = screen.getByRole('button', { name: 'A társ önvizsgálata' })
    expect(metaTile).toHaveClass('meta')
    expect(metaTile).not.toHaveClass('chapter')
    expect(container.querySelectorAll('.kr-dimtile.chapter')).toHaveLength(1)
  })

  test('clicking a tile navigates to its own dimension page', async () => {
    render(<DimensionsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Fizikai' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/dimenzio/physical')
  })

  test('overview null (character switch off) renders the degraded row, never a crash', () => {
    hoisted.overview = null
    render(<DimensionsPage />)
    expect(screen.getByText(/jelenleg nem elérhető/)).toBeInTheDocument()
  })
})
