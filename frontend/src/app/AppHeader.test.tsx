import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppHeader } from '@/app/AppHeader'
import { QueryWrapper } from '@/test/queryWrapper'

// A fejléc a shellben él, tehát MINDKÉT módú CI-futásban ugyanazt kell mutatnia —
// ezért a mock mód kényszerítve van (ugyanaz a minta, mint a hubHeaders.test.tsx-ben).
// Mock módban a companion-feed üres, a demo-briefing viszont megvan → PONTOSAN 1 üzenet,
// és a notificationFeedSeed-ben 3 olvasatlan értesítés van (nf-1..nf-3).
// Az óra 13:00-ra van fagyasztva: a `mockSleepGoal` (ébredés 06:45, cél 450 perc → lefekvés
// 23:15) `faceWindows`-a ekkor reggel 06:15–11:45, nap 11:45–19:15, este 19:15–06:15 — 13:00
// egyértelműen `nap`, determinisztikusan mindkét CI-módban. Enélkül a `?dp=` navigáció és az
// `.nap-offnow` pötty tesztjei a fal-órától függő, flaky eredményt adnának.
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 7, 30, 13, 0, 0)) // 13:00 → nowFace === 'nap' (mockSleepGoal)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

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

test('a napszakváltó a /fuel oldalról a valóstól eltérő napszakra dp paraméterrel dob', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  await user.click(screen.getByRole('menuitem', { name: 'Este' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap?dp=este')
})

test('a napszakváltó a jelenlegi (valós) napszak választásakor sima /nap-ra dob, dp nélkül', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  await user.click(screen.getByRole('menuitem', { name: 'Nap' })) // 13:00 → nowFace === 'nap'
  const loc = screen.getByTestId('loc')
  expect(loc).toHaveTextContent('/nap')
  expect(loc.textContent).toBe('/nap')
})

test('a napszakváltó menüje bezárul a választás után', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  const menu = screen.getByRole('menu')
  await user.click(screen.getByRole('menuitem', { name: 'Reggel' }))
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

test('/nap?dp=nap esetén nincs eltérés-pötty, mert ez a jelenlegi napszak', async () => {
  const { container } = renderAt('/nap?dp=nap')
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(container.querySelector('.nap-offnow')).toBeNull()
})

test('az Üzenetek karika a /nap/uzenetek oldalra navigál', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/mezo')
  await user.click(await screen.findByRole('button', { name: /^Mezo üzenetei/ }))
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
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap')
  await user.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  await user.click(screen.getByRole('menuitem', { name: 'Összes értesítés ›' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ertesitesek')
})

test('a két dropdown kölcsönösen kizárja egymást', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { container } = renderAt('/nap')
  await user.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  expect(container.querySelector('.nap-dpmenu')).not.toBeNull()
  await user.click(screen.getByRole('button', { name: /^Értesítések/ }))
  expect(container.querySelector('.nap-dpmenu')).toBeNull()
  expect(container.querySelector('.nap-ntfmenu')).not.toBeNull()
})

test('a profil orb a /me oldalra visz', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  await user.click(await screen.findByRole('button', { name: 'Profil' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me')
})
