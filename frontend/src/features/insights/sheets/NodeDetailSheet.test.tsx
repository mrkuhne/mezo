import { render, screen, fireEvent } from '@testing-library/react'
import { NodeDetailSheet } from './NodeDetailSheet'
import type { KnowledgeGraphNode } from '@/data/types'

const node: KnowledgeGraphNode = {
  id: 'gn-4',
  kind: 'LIFE_EVENT',
  title: 'Új munkahely első hete',
  summary: 'Hétfőn kezdtél az új helyen, és a hét végére kimerültél.',
  topEdges: ['Új munkahely első hete → kiváltja → Megnövekedett stressz · közepes'],
  sourceKind: null,
  updatedAt: '2026-08-22T08:00:00.000Z',
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
  // no edges → no "Kapcsolatok" section label either
  expect(screen.queryByText('Kapcsolatok')).not.toBeInTheDocument()
})

// mezo-ni86: the sheet says which category the node belongs to, and labels the
// edge-line block — without these, a bare backend title („Utolsó Cut") gave the
// reader nothing to anchor on.
test('names the kind and labels the edge block', () => {
  render(<NodeDetailSheet node={node} onArchive={() => {}} onClose={() => {}} />)
  expect(screen.getByText('Életesemények')).toBeInTheDocument()
  expect(screen.getByText('Kapcsolatok')).toBeInTheDocument()
})

// mezo-ni86: the weekly graph builder sometimes emits summary === title (live
// GOAL nodes) — repeating the heading verbatim under itself says nothing.
test('hides a summary that merely repeats the title', () => {
  render(
    <NodeDetailSheet
      node={{ ...node, summary: 'Új munkahely első hete' }}
      onArchive={() => {}}
      onClose={() => {}}
    />,
  )
  expect(screen.getAllByText('Új munkahely első hete')).toHaveLength(1)
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
