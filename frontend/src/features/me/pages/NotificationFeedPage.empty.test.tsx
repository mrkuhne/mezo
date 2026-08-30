import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotificationFeedPage } from '@/features/me/pages/NotificationFeedPage'
import { QueryWrapper } from '@/test/queryWrapper'

vi.mock('@/data/notification/feedHooks', () => ({
  useNotificationFeed: () => ({ items: [], isPending: false }),
  useNotificationFeedActions: () => ({ markAllRead: vi.fn() }),
}))

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('üres feed: ghost-állapot, nap-csoport fejléc nélkül', async () => {
  const { container } = render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/ertesitesek']}>
        <NotificationFeedPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(await screen.findByText('Még nincs értesítésed.')).toBeInTheDocument()
  expect(container.querySelector('.nf-daylabel')).toBeNull()
})
