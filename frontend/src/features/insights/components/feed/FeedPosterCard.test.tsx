import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { usePatternActions, useObservationReply } from '@/data/hooks'
import { MOCK_EDITIONS } from '@/data/character/characterMock'
import { editionPost } from '@/features/insights/logic/teamEdition'
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
