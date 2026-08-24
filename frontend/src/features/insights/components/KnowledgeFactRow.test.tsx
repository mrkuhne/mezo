import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeFactRow } from '@/features/insights/components/KnowledgeFactRow'
import type { KnowledgeFact } from '@/data/types'

const patternFact: KnowledgeFact = {
  id: 'f1', text: 'Gyógyszer-ciklusnap ↔ napi kalória', category: 'health', active: true,
  reinforced: 2, source: 'pattern', patternTitle: 'Gyógyszer-ciklusnap ↔ napi kalória',
  lastReinforcedAt: '2026-08-05T19:20:00Z', createdAt: '2026-04-20T07:15:00Z',
}

test('a minta-tény emberi mondatként, eredettel és megerősítéssel jelenik meg', () => {
  render(<KnowledgeFactRow fact={patternFact} bucket="in-prompt" onToggle={() => {}} />)
  expect(screen.getByText('A gyógyszer-ciklusnap és a napi kalória együtt mozognak.')).toBeInTheDocument()
  expect(screen.getByText(/Megerősített mintából tanultam/)).toBeInTheDocument()
  expect(screen.getByText('2× visszaigazolva · utoljára Aug 5')).toBeInTheDocument()
  expect(screen.getByText('Most benne van a chatben')).toBeInTheDocument()
  expect(screen.getByText('Egészség')).toBeInTheDocument()
  expect(screen.getByText('mintából')).toBeInTheDocument()
  // az önismétlő „minta: …" chip megszűnt
  expect(screen.queryByText(/^minta: /)).not.toBeInTheDocument()
})

test('a kikapcsolt tény kimondja, hogy a társ nem látja, és a kapcsoló hívható', async () => {
  const onToggle = vi.fn()
  render(<KnowledgeFactRow fact={{ ...patternFact, active: false, reinforced: 0, lastReinforcedAt: null }} bucket="off" onToggle={onToggle} />)
  expect(screen.getByText('Kikapcsolva — a társ nem látja')).toBeInTheDocument()
  expect(screen.getByText('Még nem jött vissza megerősítés.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('switch'))
  expect(onToggle).toHaveBeenCalledTimes(1)
})
