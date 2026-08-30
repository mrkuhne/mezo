import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotificationFeedPage } from '@/features/me/pages/NotificationFeedPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { useNotificationFeed } from '@/data/notification/feedHooks'

vi.mock('@/data/notification/feedHooks', () => ({
  useNotificationFeed: vi.fn(),
  useNotificationFeedActions: () => ({ markAllRead: vi.fn() }),
}))

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderPage = () =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/ertesitesek']}>
        <NotificationFeedPage />
      </MemoryRouter>
    </QueryWrapper>,
  )

test('üres feed: ghost-állapot, nap-csoport fejléc nélkül', async () => {
  vi.mocked(useNotificationFeed).mockReturnValue({ items: [], isPending: false })
  const { container } = renderPage()
  expect(await screen.findByText('Még nincs értesítésed.')).toBeInTheDocument()
  expect(container.querySelector('.nf-daylabel')).toBeNull()
})

// A `useDualQuery` real-módban `realEmpty: []`-t ad vissza a hideg-fetch teljes ablakára, tehát
// az ÜRES `items` önmagában nem különbözteti meg a "még nem töltött be"-t a "genuinely üres"-től
// — csak az `isPending` teszi. Egyik mock-módú teszt sem tudja ezt elkapni (a mock seed
// szinkronon oldódik fel), ezért kell ez a külön stub (fix round 1, item 1): amíg `isPending`
// igaz, a ghost-szövegnek NEM szabad megjelennie — az a "nincs értesítésed" hazugság, amit a
// feed feloldódása azonnal megcáfolna.
test('betöltés alatt (real-mód hideg fetch): nincs ghost-szöveg', async () => {
  vi.mocked(useNotificationFeed).mockReturnValue({ items: [], isPending: true })
  renderPage()
  await screen.findByText('Értesítések')
  expect(screen.queryByText('Még nincs értesítésed.')).not.toBeInTheDocument()
})
