import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { candidateSeed, facts as knowledgeSeed } from '@/data/insights/knowledge'
import { lifeEventCandidateSeed } from '@/data/insights/graph'
import { ROLAD_COPY } from '@/features/insights/logic/roladCopy'
import type { RoladInboxState } from './RoladInbox'
import { RoladInbox } from './RoladInbox'

const inbox = (over: Partial<RoladInboxState> = {}): RoladInboxState => ({
  facts: knowledgeSeed, candidates: candidateSeed, lifeEvents: lifeEventCandidateSeed, settled: [],
  degraded: false, isPending: false, isError: false, refetch: vi.fn(),
  isLifeEventsError: false, refetchLifeEvents: vi.fn(),
  decideFact: vi.fn(), decideLifeEvent: vi.fn(), toggleFact: vi.fn(),
  ...over,
})

describe('RoladInbox', () => {
  // S6c (mezo-2dfy2): the short distributor — at most 2 open cards, the rest behind the fold.
  test('collapsed by default: 2 open cards, the hint still counts every open candidate', () => {
    render(<RoladInbox inbox={inbox()} />)
    const region = screen.getByRole('region', { name: 'Döntésre vár' })
    const open = candidateSeed.length + lifeEventCandidateSeed.length
    expect(within(region).getByText(`${open} JELÖLT`)).toBeInTheDocument()
    expect(region.querySelectorAll('[data-fact-candidate], [data-graph-card]')).toHaveLength(2)
    expect(within(region).getByRole('button', { name: new RegExp(ROLAD_COPY.foldMore(open - 2)) })).toBeInTheDocument()
  })

  test('the fold expands to every open card and collapses back', async () => {
    render(<RoladInbox inbox={inbox()} />)
    const region = screen.getByRole('region', { name: 'Döntésre vár' })
    const open = candidateSeed.length + lifeEventCandidateSeed.length
    await userEvent.click(within(region).getByRole('button', { name: /Még \d+ javaslat/ }))
    expect(region.querySelectorAll('[data-fact-candidate], [data-graph-card]')).toHaveLength(open)
    await userEvent.click(within(region).getByRole('button', { name: new RegExp(ROLAD_COPY.foldLess) }))
    expect(region.querySelectorAll('[data-fact-candidate], [data-graph-card]')).toHaveLength(2)
  })

  test('an afterlife line stays visible in place while collapsed (settled this mount)', () => {
    render(<RoladInbox inbox={inbox({
      settled: [{ id: 'x', kind: 'FACT', title: 'Most eldöntött', outcome: 'snooze', edgeCount: 0 }],
    })} />)
    const region = screen.getByRole('region', { name: 'Döntésre vár' })
    expect(within(region).getByText('Most eldöntött').closest('.kr9-gone')).not.toBeNull()
    expect(region.querySelectorAll('[data-fact-candidate], [data-graph-card]')).toHaveLength(2)
  })

  test('a fact candidate’s decision reaches the hook with the candidate', async () => {
    const i = inbox()
    render(<RoladInbox inbox={i} />)
    const card = screen.getByText(candidateSeed[0].text).closest('[data-fact-candidate]') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Most ne' }))
    expect(i.decideFact).toHaveBeenCalledWith(candidateSeed[0], 'snooze')
  })

  test('settled items keep an afterlife line: kept fact, kept graph node, snoozed, rejected', () => {
    render(<RoladInbox inbox={inbox({
      candidates: [], lifeEvents: [],
      settled: [
        { id: 'a', kind: 'FACT', title: 'Megtartott tény', outcome: 'keep', edgeCount: 0 },
        { id: 'b', kind: 'LIFE_EVENT', title: 'Megtartott esemény', outcome: 'keep', edgeCount: 2 },
        { id: 'c', kind: 'FACT', title: 'Halasztott', outcome: 'snooze', edgeCount: 0 },
        { id: 'd', kind: 'SEASON', title: 'Elvetett', outcome: 'reject', edgeCount: 0 },
      ],
    })} />)
    expect(screen.getByText('MIND ELDÖNTVE')).toBeInTheDocument()
    const kept = screen.getByText('Megtartott tény').closest('.tf-case') as HTMLElement
    expect(kept).toHaveClass('glass', 'tf-c-sage')
    expect(kept).toHaveTextContent(ROLAD_COPY.keep)
    expect(screen.getByText('Megtartott esemény').closest('[data-accepted]')).toHaveTextContent('Bekerült a gráfba · 2 kapcsolattal')
    const snoozed = screen.getByText('Halasztott').closest('.kr9-gone') as HTMLElement
    expect(snoozed).toHaveTextContent(ROLAD_COPY.snooze)
    expect(snoozed.querySelector('use[href="#t-clock"]')).not.toBeNull()
    const rejected = screen.getByText('Elvetett').closest('.kr9-gone') as HTMLElement
    expect(rejected).toHaveTextContent(ROLAD_COPY.reject)
    expect(rejected.querySelector('use[href="#t-skip"]')).not.toBeNull()
  })

  test('nothing open, nothing settled → the quiet line', () => {
    render(<RoladInbox inbox={inbox({ candidates: [], lifeEvents: [] })} />)
    expect(screen.getByText('Nincs döntésre váró javaslat.')).toHaveClass('kr9-quiet')
  })

  test('degraded: the honest dashed line, and the graph candidates still render', () => {
    render(<RoladInbox inbox={inbox({ degraded: true, candidates: [] })} />)
    expect(screen.getByText(/A társ jelenleg nincs bekapcsolva — a tényjavaslatok most nem elérhetők/)).toBeInTheDocument()
    expect(screen.getByText(lifeEventCandidateSeed[0].title)).toBeInTheDocument()
  })

  test('loading and failure are honest states, the failure retries', async () => {
    const { rerender } = render(<RoladInbox inbox={inbox({ isPending: true })} />)
    expect(screen.getByText('A javaslatok betöltése…')).toBeInTheDocument()
    const i = inbox({ isError: true })
    rerender(<RoladInbox inbox={i} />)
    await userEvent.click(screen.getByRole('button', { name: 'Újra' }))
    expect(i.refetch).toHaveBeenCalled()
  })

  // Rólad polish (mezo-plbev, item 2): the life-event candidates are a SEPARATE honest layer —
  // their own failure must not hide the fact cards that ARE working, and must offer its own retry.
  test('a life-event query error is a quiet retry line under the fact cards, not a full-section wipe', async () => {
    const i = inbox({ isLifeEventsError: true })
    render(<RoladInbox inbox={i} />)
    // fact candidates still render
    expect(screen.getByText(candidateSeed[0].text)).toBeInTheDocument()
    const quiet = screen.getByText(/Nem sikerült betölteni az életesemény-javaslatokat\./)
    await userEvent.click(within(quiet.closest('p') as HTMLElement).getByRole('button', { name: 'Újra' }))
    expect(i.refetchLifeEvents).toHaveBeenCalled()
  })
})
