// CharacterFeedPage — day-grouped rows + konzílium-diff rows (mezo-1gim.13, Task 4).
// Mode-agnostic via the KarakterHubPage.test.tsx hook-override idiom.
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CharacterFeedPage } from './CharacterFeedPage'
import { MOCK_EXPERTS, MOCK_FEED } from '@/data/character/characterMock'
import type { CharacterFeedItem } from '@/data/character/characterApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const hoisted = vi.hoisted(() => ({ items: [] as CharacterFeedItem[] }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterFeed: () => ({ items: hoisted.items, isLoading: false }),
    useCharacterExperts: () => ({ experts: MOCK_EXPERTS, isLoading: false }),
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-30T20:00:00Z'))
  hoisted.items = MOCK_FEED
  mockNavigate.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('CharacterFeedPage', () => {
  test('groups rows by day with HU labels (MA / TEGNAP / formatted date)', () => {
    render(<CharacterFeedPage />)
    expect(screen.getByText('MA')).toBeInTheDocument()
    expect(screen.getByText('TEGNAP')).toBeInTheDocument()
  })

  test('renders an observation row with the expert name and text', () => {
    render(<CharacterFeedPage />)
    expect(screen.getByText('Doki')).toBeInTheDocument()
    expect(screen.getByText(/A reggeli mérések három hete makulátlanul/)).toBeInTheDocument()
  })

  test('a "user" expertKey item gets the gold Te disc, never routed through PersonaOrb as Mezo', () => {
    hoisted.items = [
      { kind: 'OBSERVATION', at: '2026-08-30T09:00:00Z', expertKey: 'user', text: 'Daniel saját megfigyelése.' },
      ...MOCK_FEED,
    ]
    const { container } = render(<CharacterFeedPage />)
    expect(container.querySelectorAll('.kr-feeddisc.user')).toHaveLength(1)
    expect(screen.getAllByText('Te').length).toBeGreaterThan(0)
  })

  test('CONFERENCE_CHANGE items render as a coral diff row that navigates to the konzílium', () => {
    render(<CharacterFeedPage />)
    const diffRow = screen.getByText(/Vasárnapi konzílium/).closest('button')
    expect(diffRow).toHaveClass('kr-feeddiff')
    fireEvent.click(diffRow!)
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/konzilium')
  })

  test('an honestly empty feed renders no fabricated rows', () => {
    hoisted.items = []
    render(<CharacterFeedPage />)
    expect(screen.getByText(/nincs friss megfigyelés/)).toBeInTheDocument()
  })
})
