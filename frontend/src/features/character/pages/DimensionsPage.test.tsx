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

  test('the CHAPTER dimension is marked as a chapter and wears the spark icon instead of a figure (U9)', () => {
    const { container } = render(<DimensionsPage />)
    const chapterTile = screen.getByRole('button', { name: 'Munka-stressz ciklus' })
    expect(chapterTile).toHaveClass('kr9-chapter')
    expect(chapterTile.querySelector('use[href="#t-spark"]')).toBeInTheDocument()
    expect(chapterTile.querySelector('.kr-persona')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.kr9-dim.kr9-chapter')).toHaveLength(1)
  })

  test('every dimension is a glass row with the owning character figure and its maturity badge (U9)', () => {
    render(<DimensionsPage />)
    const physical = screen.getByRole('button', { name: 'Fizikai' })
    expect(physical).toHaveClass('glass', 'tf-rowg')
    expect(physical.querySelector('.kr-persona')).toHaveAttribute('data-character', 'deru')
    const d = MOCK_OVERVIEW.dimensions.find((x) => x.title === 'Fizikai')!
    expect(physical).toHaveTextContent(`${d.maturity}%`)
  })

  test('standalone wears the back head; embedded opens under a section heading instead (U9)', async () => {
    const { unmount } = render(<DimensionsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(mockNavigate).toHaveBeenCalledWith('/mezo/rolad')
    unmount()
    render(<DimensionsPage embedded />)
    expect(screen.queryByRole('button', { name: 'Vissza' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Amit eddig tudunk rólad' })).toBeInTheDocument()
  })

  test('the META dimension is marked meta, not chapter', () => {
    const { container } = render(<DimensionsPage />)
    const metaTile = screen.getByRole('button', { name: 'A társ önvizsgálata' })
    expect(metaTile).toHaveClass('kr9-meta')
    expect(metaTile).not.toHaveClass('kr9-chapter')
    expect(container.querySelectorAll('.kr9-dim.kr9-chapter')).toHaveLength(1)
  })

  test('clicking a tile navigates to its own dimension page', async () => {
    render(<DimensionsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Fizikai' }))
    expect(mockNavigate).toHaveBeenCalledWith('/mezo/karakter/dimenzio/physical')
  })

  test('overview null (character switch off) renders the degraded row, never a crash', () => {
    hoisted.overview = null
    render(<DimensionsPage />)
    expect(screen.getByText(/jelenleg nem elérhető/)).toBeInTheDocument()
  })
})
