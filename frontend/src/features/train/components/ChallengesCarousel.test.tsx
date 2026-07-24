import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ChallengesCarousel } from '@/features/train/components/ChallengesCarousel'
import type { Challenge } from '@/data/types'

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'ch-1',
    type: 'PR',
    typeLabel: 'PR-attempt',
    exerciseId: 'ex-1',
    exercise: 'Chest Supported Row',
    target: '107.5 kg × 8',
    confidence: 0.72,
    risk: 'low',
    why: 'Teszt indoklás.',
    refs: [],
    glory: 'Új csúcs',
    ...overrides,
  }
}

describe('ChallengesCarousel', () => {
  // The lazy-on-prep LLM generation gap (1-3s, prod bug 2026-07-24) must render a visible
  // skeleton instead of silently showing nothing.
  test('pending renders the loading copy and no quest cards', () => {
    render(<ChallengesCarousel challenges={[]} accepted={{}} onToggle={vi.fn()} pending />)
    expect(screen.getByText('Kihívások generálása…')).toBeInTheDocument()
    expect(screen.queryByText('⚔ Elfogadom')).not.toBeInTheDocument()
    expect(screen.queryByText('Ma nincs kihívás')).not.toBeInTheDocument()
  })

  test('resolved-empty (not pending) renders the honest empty line', () => {
    render(<ChallengesCarousel challenges={[]} accepted={{}} onToggle={vi.fn()} />)
    expect(screen.getByText('Ma nincs kihívás')).toBeInTheDocument()
    expect(screen.queryByText('Kihívások generálása…')).not.toBeInTheDocument()
  })

  test('renders the quest cards + the counted section eyebrow when neither pending nor empty', () => {
    render(<ChallengesCarousel challenges={[challenge()]} accepted={{}} onToggle={vi.fn()} />)
    expect(screen.getByText('⚔ A mai küldetések · 1')).toBeInTheDocument()
    expect(screen.getByText('⚔ Elfogadom')).toBeInTheDocument()
    expect(screen.queryByText('Ma nincs kihívás')).not.toBeInTheDocument()
    expect(screen.queryByText('Kihívások generálása…')).not.toBeInTheDocument()
  })
})
