import { render, screen, fireEvent } from '@testing-library/react'
import { NodeDetailSheet } from '@/features/me/sheets/NodeDetailSheet'
import type { KnowledgeGraphNode } from '@/data/types'

const node: KnowledgeGraphNode = {
  id: 'gn-4',
  kind: 'LIFE_EVENT',
  title: 'Új munkahely első hete',
  summary: 'Hétfőn kezdtél az új helyen, és a hét végére kimerültél.',
  topEdges: ['Új munkahely első hete → kiváltja → Megnövekedett stressz · közepes'],
  sourceKind: null,
}

test('renders title, summary, edge lines and the archive footnote', () => {
  render(<NodeDetailSheet node={node} onArchive={() => {}} onClose={() => {}} />)
  expect(screen.getByText('Új munkahely első hete')).toBeInTheDocument()
  expect(screen.getByText(/Hétfőn kezdtél az új helyen/)).toBeInTheDocument()
  expect(screen.getByText(/Megnövekedett stressz · közepes/)).toBeInTheDocument()
  expect(screen.getByText(/Archiválás után a következő heti összegzésig/)).toBeInTheDocument()
})

test('summary and edges are optional', () => {
  render(
    <NodeDetailSheet
      node={{ ...node, summary: null, topEdges: [] }}
      onArchive={() => {}}
      onClose={() => {}}
    />,
  )
  expect(screen.getByText('Új munkahely első hete')).toBeInTheDocument()
  expect(screen.queryByText(/Hétfőn kezdtél/)).not.toBeInTheDocument()
})

test('Archivál calls onArchive and dismisses the sheet', () => {
  const onArchive = vi.fn()
  const onClose = vi.fn()
  render(<NodeDetailSheet node={node} onArchive={onArchive} onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: 'Archivál' }))
  expect(onArchive).toHaveBeenCalledTimes(1)
  // the shared Sheet's animated close ends in onClose; under jsdom the
  // transitionend fallback timer fires, so wait for it
  return vi.waitFor(() => expect(onClose).toHaveBeenCalled())
})
