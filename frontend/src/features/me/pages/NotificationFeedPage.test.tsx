import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { NotificationFeedPage } from '@/features/me/pages/NotificationFeedPage'
import { QueryWrapper } from '@/test/queryWrapper'

// A mock seed (data/notification/feedMock.ts) MAI napra van kötve (`at(daysAgo, hh:mm)`):
// 3 olvasatlan ma (nf-1..nf-3), 3 olvasott tegnap-előtti napokon szétosztva (nf-4..nf-6).
// Ezért a mód kényszerítve van, hogy a real-módú CI-futás is ugyanezt lássa.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
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

test('a hero a nyitáskori olvasatlan-számot viszi, nem nullát', async () => {
  const { container } = renderPage()
  expect(await screen.findByText('Értesítések')).toBeInTheDocument()
  expect(container.querySelector('.mz-bignum')).toHaveTextContent('3')
})

test('a mai elemek a Ma csoportba kerülnek, a régebbiek dátum-címke alá', async () => {
  const { container } = renderPage()
  await screen.findByText('Ma')
  const labels = [...container.querySelectorAll('.nf-daylabel')].map((e) => e.textContent)
  expect(labels[0]).toBe('Ma')
  expect(labels).not.toContain('Korábban')
  const maGroup = container.querySelector('.nf-group')!
  expect(within(maGroup as HTMLElement).getAllByRole('button')).toHaveLength(3)
})

test('egy sor koppintása a deeplinkre navigál', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: /Új minta vár döntésre/ }))
  // A MemoryRouter nem futtatja a router.tsx `insights/*` átirányítását, ezért a nyers
  // deeplinket pinneljük — a prefix-átirányítást a Task 3 route-tesztje fedi le.
  expect(screen.getByTestId('loc')).toHaveTextContent('/insights/patterns/late-meal-sleep')
})

// A badge azonnal nullázódik (markAllRead), de amíg az oldalon vagyunk, LÁTNI kell, mi volt új.
test('a nyitáskor olvasatlan sorok kiemelve maradnak az oldalon', async () => {
  const { container } = renderPage()
  await screen.findByText('Ma')
  expect(container.querySelectorAll('.nf-row.unread')).toHaveLength(3)
  expect(container.querySelectorAll('.nf-dot')).toHaveLength(3)
})

test('a Beállítások gomb a beállítások aloldalra visz', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Beállítások' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ertesitesek/beallitasok')
})
