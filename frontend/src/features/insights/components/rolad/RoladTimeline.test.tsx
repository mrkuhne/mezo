import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { KnowledgeGraphNode } from '@/data/types'
import { PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { huMonthDayAged, localDateString } from '@/shared/lib/dates'
import { RoladTimeline } from './RoladTimeline'

const node = (id: string, over: Partial<KnowledgeGraphNode>): KnowledgeGraphNode => ({
  id, kind: 'LIFE_EVENT', title: id, summary: null, topEdges: [], sourceKind: null,
  updatedAt: '2026-08-01T10:00:00Z', occurredOn: null, ...over,
})

describe('RoladTimeline', () => {
  // Rólad polish (mezo-plbev, item 6): a fallback keyed off `updatedAt` must read the LOCAL day,
  // not UTC's `.slice(0, 10)` — an evening entry in a positive-offset timezone would otherwise
  // roll forward to tomorrow, both for the sort key and the displayed date.
  test('missing occurredOn falls back to the LOCAL date of updatedAt, not a UTC slice', () => {
    // 23:30 UTC is already the next LOCAL day in any positive-offset timezone the test runs in —
    // pin a value far enough from midnight that `localDateString` and a bare UTC slice disagree
    // regardless of the runner's own zone: use an explicit late-UTC timestamp and assert the
    // rendered label matches `localDateString`, not the UTC calendar day.
    const updatedAt = '2026-08-21T23:30:00Z'
    const expectedLocalDay = localDateString(new Date(updatedAt))
    render(<RoladTimeline nodes={[node('Esti bejegyzés', { occurredOn: null, updatedAt })]} />)
    expect(screen.getByText(huMonthDayAged(expectedLocalDay))).toBeInTheDocument()
  })

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

  // Rólad polish (mezo-plbev, item 2): a genuine graph-query failure must not read as "no life
  // events yet" — it needs its own honest state with a retry, even when the node list is empty.
  test('isError → the honest GhostState with a working retry, even with no nodes', async () => {
    const onRetry = vi.fn()
    render(<RoladTimeline nodes={[]} isError onRetry={onRetry} />)
    expect(screen.getByText('Nem sikerült betölteni az életeseményeket.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Újra' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
