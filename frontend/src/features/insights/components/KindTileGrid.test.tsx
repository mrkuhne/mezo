import { render, screen, fireEvent } from '@testing-library/react'
import { KindTileGrid } from './KindTileGrid'
import type { KnowledgeGraphNode } from '@/data/types'

const mk = (id: string, kind: KnowledgeGraphNode['kind'], title: string): KnowledgeGraphNode =>
  ({ id, kind, title, summary: null, topEdges: [], sourceKind: null, updatedAt: '2026-08-20T10:00:00.000Z' })

const nodes = [
  mk('n1', 'PATTERN', 'Késői evés rontja az alvást'),
  mk('n2', 'PATTERN', 'Futás-napokon jobban alszol'),
  mk('n3', 'GOAL', 'Nyári forma'),
]

test('renders all six kind tiles with counts and the first node title as sample', () => {
  render(<KindTileGrid nodes={nodes} onOpenKind={() => {}} />)
  const pattern = screen.getByRole('button', { name: 'Minták' })
  expect(pattern).toHaveTextContent('2')
  expect(pattern).toHaveTextContent('Késői evés rontja az alvást')
  // empty kinds render as dimmed, non-interactive tiles (stable grid)
  expect(screen.queryByRole('button', { name: 'Szezonok' })).not.toBeInTheDocument()
  expect(screen.getByText('Szezonok')).toBeInTheDocument()
})

test('tapping a populated tile reports its kind', () => {
  const onOpenKind = vi.fn()
  render(<KindTileGrid nodes={nodes} onOpenKind={onOpenKind} />)
  fireEvent.click(screen.getByRole('button', { name: 'Célok' }))
  expect(onOpenKind).toHaveBeenCalledWith('GOAL')
})

test('populated tiles are glass in the kind accent, empty ones are dashed and inert (üveg U9)', () => {
  render(<KindTileGrid nodes={nodes} onOpenKind={() => {}} />)
  const pattern = screen.getByRole('button', { name: 'Minták' })
  expect(pattern).toHaveClass('glass')
  expect(pattern.style.getPropertyValue('--c')).toBe('var(--dv-amber)')
  expect(pattern.querySelector('.t-ico')).not.toBeNull()
  const seasonTile = screen.getByText('Szezonok').closest('.tud9-kind-empty')
  expect(seasonTile).not.toBeNull()
  expect(seasonTile).not.toHaveClass('glass')
  expect(seasonTile!.tagName).toBe('DIV')
})
