import { render, screen, fireEvent } from '@testing-library/react'
import { KindNodeList } from '@/features/me/components/KindNodeList'
import type { KnowledgeGraphNode } from '@/data/types'

const nodes: KnowledgeGraphNode[] = [
  { id: 'n1', kind: 'PATTERN', title: 'Késői evés rontja az alvást', summary: null,
    topEdges: ['a → b · erős', 'b → c · közepes'], sourceKind: null },
  { id: 'n2', kind: 'PATTERN', title: 'Futás-napokon jobban alszol', summary: null,
    topEdges: [], sourceKind: null },
]

const setup = (over: Partial<Parameters<typeof KindNodeList>[0]> = {}) => {
  const onBack = vi.fn(); const onOpenNode = vi.fn()
  render(<KindNodeList kind="PATTERN" label="Minták" nodes={nodes}
    onBack={onBack} onOpenNode={onOpenNode} {...over} />)
  return { onBack, onOpenNode }
}

test('renders the category header, the back chip and one compact row per node', () => {
  setup()
  expect(screen.getByText('Minták · 2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '‹ Kategóriák' })).toBeInTheDocument()
  expect(screen.getByText('Késői evés rontja az alvást')).toBeInTheDocument()
  // edge count rides the row; zero-edge rows omit it
  expect(screen.getByText('2 kapcsolat')).toBeInTheDocument()
  expect(screen.queryByText('0 kapcsolat')).not.toBeInTheDocument()
  // compact rows: no summary, no edge lines, no archive button
  expect(screen.queryByText('a → b · erős')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archivál' })).not.toBeInTheDocument()
})

test('back chip and row taps report up', () => {
  const { onBack, onOpenNode } = setup()
  fireEvent.click(screen.getByRole('button', { name: '‹ Kategóriák' }))
  expect(onBack).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Futás-napokon jobban alszol' }))
  expect(onOpenNode).toHaveBeenCalledWith(nodes[1])
})
