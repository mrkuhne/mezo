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
  // a csempe kategória-sora a prototípus kisbetűs nyelvét beszéli (mezo-d20.5.5)
  expect(screen.getByText('egészség')).toBeInTheDocument()
  expect(screen.getByText('mintából')).toBeInTheDocument()
  // az önismétlő „minta: …" chip megszűnt
  expect(screen.queryByText(/^minta: /)).not.toBeInTheDocument()
})

test('a tény kategória-mosott csempe clay ikon-koronggal (iterációk §1 tile pass)', () => {
  const { container } = render(<KnowledgeFactRow fact={patternFact} bucket="in-prompt" onToggle={() => {}} />)
  const tile = container.querySelector('.mz-facttile')
  expect(tile).not.toBeNull()
  // egészség → borostyán wash (edzés korall · egészség borostyán · élet égkék · étkezés zsálya)
  expect(tile).toHaveClass('mz-w-gold')
  expect(tile!.querySelector('.mz-fic svg')).not.toBeNull()
})

test('a kikapcsolt tény kimondja, hogy a társ nem látja, szaggatottra halkul, és a kapcsoló hívható', async () => {
  const onToggle = vi.fn()
  const { container } = render(
    <KnowledgeFactRow fact={{ ...patternFact, active: false, reinforced: 0, lastReinforcedAt: null }} bucket="off" onToggle={onToggle} />,
  )
  expect(screen.getByText('Kikapcsolva — a társ nem látja')).toBeInTheDocument()
  expect(screen.getByText('Még nem jött vissza megerősítés.')).toBeInTheDocument()
  expect(container.querySelector('.mz-facttile')).toHaveClass('off')
  await userEvent.click(screen.getByRole('switch'))
  expect(onToggle).toHaveBeenCalledTimes(1)
})
