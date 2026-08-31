import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { PrepKuldetesekPage } from '@/features/train/pages/prep/PrepKuldetesekPage'
import type { Challenge } from '@/data/types'

const CH: Challenge = {
  id: 'c1', type: 'PR', typeLabel: 'PR-kísérlet', exerciseId: 'e1', exercise: 'Fekvenyomás',
  target: '80 kg × 5', risk: 'low', why: 'jó formában vagy', refs: [], glory: 'új csúcs',
}

const base = { accepted: {}, onToggle: vi.fn(), onBack: vi.fn() }

describe('PrepKuldetesekPage', () => {
  test('pending: game-style loader instead of cards, dashed hero, … stat cells', () => {
    render(<PrepKuldetesekPage {...base} challenges={[]} pending />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('–/–')).toBeInTheDocument()
    expect(screen.getAllByText('…')).toHaveLength(2)
    expect(screen.queryByText('Ma nincs kihívás')).not.toBeInTheDocument()
  })

  test('loaded: cards render, loader gone, real counts in hero and cells', () => {
    render(<PrepKuldetesekPage {...base} challenges={[CH]} accepted={{ c1: true }} pending={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('1/1')).toBeInTheDocument()
    expect(screen.getByText('PR-kísérlet · Fekvenyomás')).toBeInTheDocument()
  })

  test('loaded empty: honest empty state', () => {
    render(<PrepKuldetesekPage {...base} challenges={[]} pending={false} />)
    expect(screen.getByText('Ma nincs kihívás')).toBeInTheDocument()
    expect(screen.getByText('0/0')).toBeInTheDocument()
  })
})
