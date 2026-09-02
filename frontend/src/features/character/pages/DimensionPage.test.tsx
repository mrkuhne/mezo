// DimensionPage — hero, portrait card, claim tiles, chat handoff (mezo-1gim.13, Task 4).
// Mode-agnostic via the KarakterHubPage.test.tsx hook-override idiom.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DimensionPage } from './DimensionPage'
import { MOCK_DIMENSIONS, MOCK_EXPERTS } from '@/data/character/characterMock'
import type { CharacterDimensionResponse } from '@/data/character/characterApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ key: hoisted.key }) }
})

const hoisted = vi.hoisted(() => ({
  key: 'physical',
  dimension: null as unknown as CharacterDimensionResponse | null,
  submitSpy: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterDimension: () => ({ dimension: hoisted.dimension, isLoading: false }),
    useCharacterExperts: () => ({ experts: MOCK_EXPERTS, isLoading: false }),
    useClaimFeedback: () => ({ submit: hoisted.submitSpy, pending: false }),
  }
})

beforeEach(() => {
  hoisted.key = 'physical'
  hoisted.dimension = MOCK_DIMENSIONS.physical
  mockNavigate.mockReset()
  hoisted.submitSpy.mockClear()
})

describe('DimensionPage', () => {
  test('renders the hero title and the count-up maturity', async () => {
    render(<DimensionPage />)
    expect(screen.getByText('Fizikai')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('58%')).toBeInTheDocument(), { timeout: 2000 })
  })

  test('renders the non-empty portrait card', () => {
    render(<DimensionPage />)
    expect(screen.getByText(MOCK_DIMENSIONS.physical.portrait)).toBeInTheDocument()
  })

  test('a dimension with an empty portrait renders no portrait card', () => {
    hoisted.dimension = { ...MOCK_DIMENSIONS.physical, portrait: '' }
    const { container } = render(<DimensionPage />)
    expect(container.querySelector('.kr-portrait')).not.toBeInTheDocument()
  })

  test('renders one ClaimTile per claim, sensitive ones framed', () => {
    const { container } = render(<DimensionPage />)
    expect(container.querySelectorAll('.kr-claim')).toHaveLength(MOCK_DIMENSIONS.physical.claims.length)
    expect(container.querySelectorAll('.kr-claim.sensitive')).toHaveLength(
      MOCK_DIMENSIONS.physical.claims.filter((c) => c.sensitive).length,
    )
  })

  test('a CHAPTER dimension (no expertKey) shows the chapter mark instead of a persona orb', () => {
    hoisted.key = 'chapter-work'
    hoisted.dimension = MOCK_DIMENSIONS['chapter-work']
    const { container } = render(<DimensionPage />)
    expect(container.querySelector('.kr-dim-avatar.chaptermark')).toBeInTheDocument()
  })

  test('a META dimension shows the Szkeptikus sub-line', () => {
    hoisted.key = 'self-audit'
    hoisted.dimension = MOCK_DIMENSIONS['self-audit']
    render(<DimensionPage />)
    expect(screen.getByText('a társ önvizsgálata · Szkeptikus')).toBeInTheDocument()
  })

  test('the chat handoff navigates plainly to the chat route (no anchored-context idiom in this codebase)', async () => {
    render(<DimensionPage />)
    await userEvent.click(screen.getByText('Beszélgess erről Mezóval'))
    expect(mockNavigate).toHaveBeenCalledWith('/mezo/chat')
  })

  test('renders the closing principle line', () => {
    render(<DimensionPage />)
    expect(screen.getByText(/Az állítások bizonyítékból születnek/)).toBeInTheDocument()
  })

  test('dimension null (404 — bad key or switch off) renders a degraded message, never a crash', () => {
    hoisted.dimension = null
    render(<DimensionPage />)
    expect(screen.getByText(/jelenleg nem elérhető/)).toBeInTheDocument()
  })
})
