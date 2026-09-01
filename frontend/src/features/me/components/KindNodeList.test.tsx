import { render, screen, fireEvent } from '@testing-library/react'
import { KindNodeList } from '@/features/me/components/KindNodeList'
import type { KnowledgeGraphNode } from '@/data/types'

const nodes: KnowledgeGraphNode[] = [
  { id: 'n1', kind: 'PATTERN', title: 'Késői evés rontja az alvást', summary: null,
    topEdges: ['a → b · erős', 'b → c · közepes'], sourceKind: null, updatedAt: '2026-08-20T10:00:00.000Z' },
  { id: 'n2', kind: 'PATTERN', title: 'Futás-napokon jobban alszol', summary: null,
    topEdges: [], sourceKind: null, updatedAt: '2026-08-19T10:00:00.000Z' },
]

const setup = (over: Partial<Parameters<typeof KindNodeList>[0]> = {}) => {
  const onOpenNode = vi.fn()
  render(<KindNodeList kind="PATTERN" label="Minták" nodes={nodes}
    onOpenNode={onOpenNode} {...over} />)
  return { onOpenNode }
}

test('renders the category header and one compact row per node', () => {
  setup()
  expect(screen.getByText('Minták · 2')).toBeInTheDocument()
  expect(screen.getByText('Késői evés rontja az alvást')).toBeInTheDocument()
  // edge count rides the row; zero-edge rows omit it
  expect(screen.getByText('2 kapcsolat')).toBeInTheDocument()
  expect(screen.queryByText('0 kapcsolat')).not.toBeInTheDocument()
  // compact rows: no summary, no edge lines, no archive button
  expect(screen.queryByText('a → b · erős')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archivál' })).not.toBeInTheDocument()
})

// mezo-ni86: the back affordance lives in the page-head (KnowledgePage), not here —
// a second in-body chip read as a different destination.
test('renders no back chip of its own', () => {
  setup()
  expect(screen.queryByRole('button', { name: '‹ Kategóriák' })).not.toBeInTheDocument()
})

test('row taps report the node up', () => {
  const { onOpenNode } = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Futás-napokon jobban alszol' }))
  expect(onOpenNode).toHaveBeenCalledWith(nodes[1])
})
