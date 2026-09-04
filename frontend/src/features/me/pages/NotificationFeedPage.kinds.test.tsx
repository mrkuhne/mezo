import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { NotificationFeedPage } from '@/features/me/pages/NotificationFeedPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { useNotificationFeed } from '@/data/notification/feedHooks'
import type { AppNotificationKindKey, AppNotificationView } from '@/data/types'

// mezo-ntf8, élesben: egy `weekly_review_ready` sor az EGÉSZ feed-oldalt az ErrorBoundary-ra
// dobta, mert a kind-leképezés 12 fajtát ismert és a backend enum 13-at — a sor-map `meta.tint`-je
// `undefined`-en hasalt el. A régi dropdown csak a legfrissebb 3 sort rajzolta, ezért rejtve
// maradt. Ez a fájl a két oldalt külön pinneli: a hiányzó fajta MEGVAN, és egy jövőbeli,
// ismeretlen fajta sem viheti el az oldalt.
vi.mock('@/data/notification/feedHooks', () => ({
  useNotificationFeed: vi.fn(),
  useNotificationFeedActions: () => ({ markAllRead: vi.fn(() => Promise.resolve()) }),
}))

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const at = (hhmm: string) => {
  const d = new Date()
  const [h, m] = hhmm.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

const item = (id: string, kind: string, deeplink = '/me/week'): AppNotificationView => ({
  id,
  kind: kind as AppNotificationKindKey,
  title: `cím ${id}`,
  body: null,
  deeplink,
  occurredAt: at('09:00'),
  readAt: null,
})

function LocationProbe() {
  return <output aria-label="Aktuális útvonal">{useLocation().pathname}</output>
}

const renderPage = () =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/ertesitesek']}>
        <NotificationFeedPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )

test('a heti-összefoglaló értesítés kirajzolódik, nem dönti el az oldalt', async () => {
  vi.mocked(useNotificationFeed).mockReturnValue({
    items: [item('a', 'weekly_review_ready'), item('b', 'memoir_ready')],
    isPending: false,
  })
  const { container } = renderPage()
  expect(await screen.findByText('cím a')).toBeInTheDocument()
  expect(screen.getByText('cím b')).toBeInTheDocument()
  expect(container.querySelector('.nf-ico use[href="#i-heti"]')).not.toBeNull()
})

test('egy ismeretlen backend-fajta semlegesen rajzolódik, a többi sor megmarad', async () => {
  vi.mocked(useNotificationFeed).mockReturnValue({
    items: [item('x', 'brand_new_backend_kind'), item('y', 'memory_note')],
    isPending: false,
  })
  const { container } = renderPage()
  expect(await screen.findByText('cím x')).toBeInTheDocument()
  expect(screen.getByText('cím y')).toBeInTheDocument()
  // A semleges bejegyzés a csengő-ikon; az oldal él, nem az ErrorBoundary kártyája látszik.
  expect(container.querySelector('.nf-ico use[href="#i-ertesites"]')).not.toBeNull()
  expect(screen.queryByText('Valami elromlott ezen a nézeten.')).not.toBeInTheDocument()
})

test('a céljavaslat cél ikonnal jelenik meg és a konkrét review oldalra navigál', async () => {
  const reviewPath = '/me/goals/weight/suggestions/9fd2d287-238e-48ea-bf28-87b8a24ad998'
  vi.mocked(useNotificationFeed).mockReturnValue({
    items: [item('goal', 'goal_suggestion', reviewPath)],
    isPending: false,
  })
  const { container } = renderPage()

  const row = await screen.findByRole('button', { name: /cím goal/ })
  expect(container.querySelector('.nf-ico use[href="#i-cel"]')).not.toBeNull()
  fireEvent.click(row)
  expect(screen.getByRole('status', { name: 'Aktuális útvonal' })).toHaveTextContent(reviewPath)
})
