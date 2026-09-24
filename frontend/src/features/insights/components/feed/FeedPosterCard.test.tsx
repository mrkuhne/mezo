import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { usePatternActions, useObservationReply } from '@/data/hooks'
import { MOCK_EDITIONS } from '@/data/character/characterMock'
import { editionPost } from '@/features/insights/logic/teamEdition'
import type { FeedPost } from '@/features/insights/logic/teamFeed'
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

/**
 * H5 (mezo-a9bo7.16): Derű kérése nem állítás, hanem kérés — a hármas és a „Miből látszik?”
 * helyén egyetlen „Bejelentkezem” gomb áll (a jóváhagyott prototípus `kérés` posztja), ami a
 * kiadás saját útvonalára, a bejelentkezésre visz. Poszterként is ugyanígy.
 */
const KERES: FeedPost = {
  id: 'edition:2026-09-24:3',
  kind: 'keres',
  author: 'deru',
  occurredAt: '2026-09-24',
  body: '14 napból **4** napról tudom, hogy vagy. Egy rövid bejelentkezés ma este sokat segítene.',
  sourceRoute: '/nap/checkin',
  waiting: false,
}

function renderAt(card: ReactNode) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/mezo/csapat']}>
        <Routes>
          <Route path="/mezo/csapat" element={card} />
          <Route path="/nap/checkin" element={<p>bejelentkezés-oldal</p>} />
          <Route path="/fuel" element={<p>fuel-oldal</p>} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test.each([
  ['csendes panel', FeedPostCard],
  ['poszter', FeedPosterCard],
] as const)('%s: a kérés-poszton „Bejelentkezem” gomb áll, és a bejelentkezésre visz', async (_, Card) => {
  renderAt(<Card post={KERES} onReply={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /Ez talál/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Elmesélem/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Miből látszik?' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Bejelentkezem' }))
  expect(await screen.findByText('bejelentkezés-oldal')).toBeInTheDocument()
})

test('Falat értékelése: nincs CTA, a „Miből látszik?” a Fuel-napra visz, a hármas megvan', async () => {
  const ertekeles: FeedPost = { ...KERES, id: 'edition:2026-09-24:2', kind: 'ertekeles', author: 'falat', body: 'Eddig ma **3 étkezésed** van.', sourceRoute: '/fuel' }
  renderAt(<FeedPostCard post={ertekeles} onReply={vi.fn()} />)
  expect(screen.getByText(/napi értékelés/)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Bejelentkezem' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Ez talál/ })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Miből látszik?' }))
  expect(await screen.findByText('fuel-oldal')).toBeInTheDocument()
})
