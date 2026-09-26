import { render, screen } from '@testing-library/react'
import type { KnowledgeGraphNode } from '@/data/types'
import { PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { RoladTimeline } from './RoladTimeline'

const node = (id: string, over: Partial<KnowledgeGraphNode>): KnowledgeGraphNode => ({
  id, kind: 'LIFE_EVENT', title: id, summary: null, topEdges: [], sourceKind: null,
  updatedAt: '2026-08-01T10:00:00Z', occurredOn: null, ...over,
})

describe('RoladTimeline', () => {
  test('life events and seasons only, newest first by when they happened', () => {
    const { container } = render(<RoladTimeline nodes={[
      node('Régi esemény', { occurredOn: '2026-03-02', updatedAt: '2026-09-20T10:00:00Z' }),
      node('Egy minta', { kind: 'PATTERN' }),
      node('Friss esemény', { occurredOn: '2026-08-21', summary: 'Hétfőn kezdtél.' }),
      node('Profil', { kind: 'LIFE_EVENT', sourceKind: PROFILE_SOURCE_KIND, occurredOn: '2026-09-01' }),
      node('Nyári alapozás', { kind: 'SEASON', occurredOn: '2026-07-01' }),
    ]} />)
    const titles = [...container.querySelectorAll('[data-life-row] b')].map((b) => b.textContent)
    expect(titles).toEqual(['Friss esemény', 'Nyári alapozás', 'Régi esemény'])
    expect(screen.getByRole('heading', { name: 'Életesemények' })).toBeInTheDocument()
    expect(screen.getByText('Hétfőn kezdtél.')).toBeInTheDocument()
  })

  test('a season is dated by its quarter', () => {
    render(<RoladTimeline nodes={[node('Nyári alapozás', { kind: 'SEASON', occurredOn: '2026-07-01' })]} />)
    expect(screen.getByText('2026. III. negyedév')).toBeInTheDocument()
  })

  test('nothing to show → nothing rendered', () => {
    const { container } = render(<RoladTimeline nodes={[node('Egy minta', { kind: 'PATTERN' })]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
