import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppHeader } from '@/app/AppHeader'
import { QueryWrapper } from '@/test/queryWrapper'

// A fejléc a shellben él, tehát MINDKÉT módú CI-futásban ugyanazt kell mutatnia —
// ezért a mock mód kényszerítve van (ugyanaz a minta, mint a hubHeaders.test.tsx-ben).
// Mock módban a companion-feed üres, a demo-briefing viszont megvan → PONTOSAN 1 üzenet,
// és a notificationFeedSeed-ben 3 olvasatlan értesítés van (nf-1..nf-3).
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
})
afterEach(() => vi.unstubAllEnvs())

/** Kiírja az élő URL-t, hogy a navigációk megfigyelhetők legyenek. */
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

const renderAt = (path: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <AppHeader />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )

test('a fejléc mind a négy kontrollt viseli, ebben a sorrendben', async () => {
  const { container } = renderAt('/fuel')
  expect(await screen.findByRole('button', { name: 'Napszak váltása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Mezo üzenetei/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Értesítések/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Profil' })).toBeInTheDocument()

  const labels = [...container.querySelectorAll('.nap-head button')]
    .map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Napszak váltása')
  expect(labels[1]).toMatch(/^Mezo üzenetei/)
  expect(labels[2]).toMatch(/^Értesítések/)
  expect(labels[3]).toBe('Profil')
})

test('a napszakváltó bármely oldalról a /nap oldalra dob, dp paraméterrel', async () => {
  renderAt('/fuel')
  await userEvent.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Este' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap?dp=este')
})

test('a napszakváltó menüje bezárul a választás után', async () => {
  renderAt('/fuel')
  await userEvent.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  const menu = screen.getByRole('menu')
  await userEvent.click(screen.getByRole('menuitem', { name: 'Reggel' }))
  expect(menu).not.toBeInTheDocument()
})

test('/nap-on kívül a dp paraméter figyelmen kívül marad és nincs eltérés-pötty', async () => {
  const { container } = renderAt('/fuel?dp=este')
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(container.querySelector('.nap-offnow')).toBeNull()
})

test('/nap?dp=este esetén az alvás-ikon és az eltérés-pötty látszik', async () => {
  const { container } = renderAt('/nap?dp=este')
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(container.querySelector('.nap-head use[href="#i-alvas"]')).not.toBeNull()
  expect(container.querySelector('.nap-offnow')).not.toBeNull()
})

test('az Üzenetek karika a /nap/uzenetek oldalra navigál', async () => {
  renderAt('/mezo')
  await userEvent.click(await screen.findByRole('button', { name: /^Mezo üzenetei/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap/uzenetek')
})

test('az Üzenetek karika badge-e az olvasatlan üzenetek számát viseli', async () => {
  renderAt('/nap')
  const btn = await screen.findByRole('button', { name: /^Mezo üzenetei/ })
  expect(btn.getAttribute('aria-label')).toBe('Mezo üzenetei, 1 olvasatlan')
  expect(btn.querySelector('.nap-badge')).toHaveTextContent('1')
})

test('az értesítés-karika badge-e az olvasatlan értesítések számát viseli', async () => {
  renderAt('/nap')
  const btn = await screen.findByRole('button', { name: /^Értesítések/ })
  expect(btn.getAttribute('aria-label')).toBe('Értesítések, 3 olvasatlan')
  expect(btn.querySelector('.nap-badge')).toHaveTextContent('3')
})

test('az értesítés-dropdown a /me/ertesitesek oldalra visz a lábléceről', async () => {
  renderAt('/nap')
  await userEvent.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Összes értesítés ›' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ertesitesek')
})

test('a két dropdown kölcsönösen kizárja egymást', async () => {
  const { container } = renderAt('/nap')
  await userEvent.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  expect(container.querySelector('.nap-dpmenu')).not.toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /^Értesítések/ }))
  expect(container.querySelector('.nap-dpmenu')).toBeNull()
  expect(container.querySelector('.nap-ntfmenu')).not.toBeNull()
})

test('a profil orb a /me oldalra visz', async () => {
  renderAt('/fuel')
  await userEvent.click(await screen.findByRole('button', { name: 'Profil' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me')
})
