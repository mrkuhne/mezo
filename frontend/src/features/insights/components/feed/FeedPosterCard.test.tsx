import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { usePatternActions, useObservationReply } from '@/data/hooks'
import { MOCK_EDITIONS } from '@/data/character/characterMock'
import { editionPost } from '@/features/insights/logic/teamEdition'
import { FeedPostCard } from './FeedPostCard'
import { FeedPosterCard } from './FeedPosterCard'

vi.mock('@/data/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  usePatternActions: vi.fn(),
  useObservationReply: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useObservationReply).mockReturnValue({ reply: vi.fn(), pendingPatternId: undefined })
  vi.mocked(usePatternActions).mockReturnValue({ decide: vi.fn(), pending: false })
})

/**
 * H3 (mezo-a9bo7.14): a karakterhangon írt poszt a fal MEGLÉVŐ inline-renderén megy át — a
 * `**kiemelés**` valódi kiemelés lesz, nem két csillag a szövegben. A fal maga semmit sem
 * fogalmaz: a szöveget a backend írta (ADR 0049), ez a teszt csak a megjelenítést rögzíti.
 */
test('a hangos kiadás-poszt kiemelése renderel, nem csillagként látszik', () => {
  const edition = MOCK_EDITIONS[0]
  const voiced = edition.posts.find(p => p.voiced)!
  render(
    <QueryWrapper>
      <MemoryRouter>
        <FeedPosterCard post={editionPost(edition, voiced)} onReply={vi.fn()} />
      </MemoryRouter>
    </QueryWrapper>,
  )

  const body = document.querySelector('.tf-body')!
  expect(body.textContent).not.toContain('**')
  expect(body.querySelectorAll('strong').length).toBeGreaterThan(0)
  expect(screen.getByText('80 g szénhidrát').tagName).toBe('STRONG')
})

/** H4 (mezo-a9bo7.15): a vendég-sorok a hármas FÖLÖTT ülnek — a poszteren és a csendes panelen is. */
test.each([
  ['poszter', FeedPosterCard],
  ['csendes panel', FeedPostCard],
] as const)('%s: a vendég-sorok a hármas fölött', (_, Card) => {
  const edition = MOCK_EDITIONS[0]
  const withGuests = edition.posts.find(p => p.guests.length === 2)!
  const { container } = render(
    <QueryWrapper>
      <MemoryRouter>
        <Card post={editionPost(edition, withGuests)} onReply={vi.fn()} />
      </MemoryRouter>
    </QueryWrapper>,
  )
  const cmts = container.querySelectorAll('.tf-cmt')
  expect(cmts).toHaveLength(2)
  const trio = container.querySelector('.tf-acts')!
  for (const c of cmts) expect(c.compareDocumentPosition(trio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('vendég nélküli poszton nincs vendég-sor', () => {
  const edition = MOCK_EDITIONS[0]
  const plain = edition.posts.find(p => p.guests.length === 0)!
  const { container } = render(
    <QueryWrapper>
      <MemoryRouter>
        <FeedPostCard post={editionPost(edition, plain)} onReply={vi.fn()} />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(container.querySelector('.tf-cmt')).toBeNull()
})
