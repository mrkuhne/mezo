import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MemoryLayersPanel } from '@/features/insights/components/MemoryLayersPanel'
import type { MemoryOverview } from '@/data/types'

/** Minimal, valid MemoryOverview — only `l1.embeddings` varies per test (mezo-b3pp.22). */
function makeOverview(embeddings: MemoryOverview['l1']['embeddings']): MemoryOverview {
  return {
    l0: { daysWithAnyData: 12, windowDays: 60 },
    l1: { summaryCount: 5, firstDate: '2026-07-01', lastDate: '2026-08-12', embeddings },
    l2: { patterns: [], pendingFactCandidates: 0 },
    l3: { facts: [], totalReinforcements: 0, factsInPrompt: 0 },
    jobs: {
      summaryCron: '0 20 2 * * *',
      patternCron: '0 40 2 * * *',
      hypothesisCron: '0 0 3 * * SUN',
      lastSummaryDate: null,
      lastDetectedAt: null,
    },
  }
}

const renderPanel = (overview: MemoryOverview) =>
  render(
    <MemoryRouter>
      <MemoryLayersPanel overview={overview} onOpenJournal={() => {}} />
    </MemoryRouter>,
  )

test('renders one stat line per populated embedding kind, with a Hungarian label', () => {
  renderPanel(makeOverview([
    { kind: 'daily_summary', count: 38 },
    { kind: 'chat_turn', count: 112 },
    { kind: 'journal_entry', count: 9 },
  ]))
  expect(screen.getByText('38 nap-vektor')).toBeInTheDocument()
  expect(screen.getByText('112 chat-vektor')).toBeInTheDocument()
  expect(screen.getByText('9 napló-vektor')).toBeInTheDocument()
})

test('falls back to the raw kind when a kind has no label yet', () => {
  renderPanel(makeOverview([{ kind: 'brand_new_kind', count: 4 }]))
  expect(screen.getByText('4 brand_new_kind-vektor')).toBeInTheDocument()
})

test('renders no vector lines when embeddings is empty', () => {
  renderPanel(makeOverview([]))
  const l1 = screen.getByText('L1 · Epizodikus napló').closest('.mem-laycard') as HTMLElement
  expect(l1.querySelector('.mem-bignm')).toHaveTextContent('5 nap')
  expect(screen.getByText('2026-07-01 – 2026-08-12')).toBeInTheDocument()
  expect(screen.queryByText(/-vektor/)).not.toBeInTheDocument()
})

test('an unparseable cron falls back honestly to the raw string on its connector', () => {
  const overview = makeOverview([])
  overview.jobs.summaryCron = '0 20 2 1 * *' // day-of-month bound — nem fordítható emberire
  renderPanel(overview)
  expect(screen.getByText('napi összefoglaló · 0 20 2 1 * *')).toBeInTheDocument()
  expect(screen.getByText('minta-felismerés · minden éjjel 02:40')).toBeInTheDocument()
})
