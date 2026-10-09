import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  seedAllKalauzSeen()
})
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

// mezo-nol0: a főnév a feedé lett, a kapcsolók alá költöztek. A fejléc dropdown lábléce
// („Összes értesítés ›") ezért változtatás nélkül a helyes helyre visz.
test('/me/ertesitesek a feedet rendereli', async () => {
  const { container } = renderAt('/me/ertesitesek')
  expect(await screen.findByText('Ma')).toBeInTheDocument()
  expect(container.querySelector('.nf-page')).toBeInTheDocument()
})

test('/me/ertesitesek/beallitasok a kapcsolókat rendereli', async () => {
  const { container } = renderAt('/me/ertesitesek/beallitasok')
  // (the title bar and the page both say it until the page is re-dressed)
  expect((await screen.findAllByText('Értesítés-beállítások')).length).toBeGreaterThan(0)
  expect(container.querySelector('.nf-page')).toBeNull()
})

test('a fejléc dropdown lábléce a feedre visz', async () => {
  renderAt('/nap')
  await userEvent.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Összes értesítés ›' }))
  expect(await screen.findByText('Ma')).toBeInTheDocument()
})

test('a feed oldal megnyitása nem törli a fejléc olvasatlan-badge-ét', async () => {
  renderAt('/nap')
  const bell = await screen.findByRole('button', { name: 'Értesítések, 5 olvasatlan' })
  expect(bell.querySelector('.fo-badge-n')).toHaveTextContent('5')

  await userEvent.click(bell)
  await userEvent.click(screen.getByRole('button', { name: 'Összes értesítés ›' }))
  await screen.findByText('Ma')

  const after = await screen.findByRole('button', { name: 'Értesítések, 5 olvasatlan' })
  expect(after.querySelector('.fo-badge-n')).toHaveTextContent('5')
})

test('legacy notification settings back leads to the common settings center', async () => {
  renderAt('/me/ertesitesek/beallitasok')
  await screen.findAllByText('Értesítés-beállítások')
  // ONE back control: the title bar's, running the page's own handler.
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByRole('heading', { name: 'Legyen a tiéd.' })).toBeInTheDocument()
})

// Folyadék frame (mezo-n4wf5.1): the settings button lives on the HUBS' title bar. The feed is a
// sub-page (back · title · bell) — so the round trip starts from the Én hub, and the feed page
// itself carries no settings button of its own or of the shell.
test('hub header → center → notifications → center preserves the origin', async () => {
  renderAt('/me')
  await screen.findByRole('button', { name: 'Célok állása' })
  expect(screen.getAllByRole('button', { name: 'Beállítások' })).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'Beállítások' }))
  // jsdom loads settings.css but not prototype.css: since U11 (mezo-zn01o) the row's `display: block`
  // lives only in the glass block, so the jsdom name may run the title into the description.
  await userEvent.click(await screen.findByRole('link', { name: /^Értesítések\s*Mikor/ }))
  await screen.findAllByText('Értesítés-beállítások')
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByRole('heading', { name: 'Legyen a tiéd.' })).toBeInTheDocument()
  // The centre's own „Vissza az oldalra" pill is handed to the shell too: the title bar's back
  // returns to the ORIGIN page (state.from), not merely one step back.
  expect(screen.queryByRole('link', { name: 'Vissza az oldalra' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByRole('button', { name: 'Célok állása' })).toBeInTheDocument()
})

test('the feed sub-page shows no settings button — its bar is back · title · bell', async () => {
  const { container } = renderAt('/me/ertesitesek')
  await screen.findByText('Ma')
  expect(container.querySelector('.nf-page')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Beállítások' })).toBeNull()
  expect([...container.querySelectorAll('.fo-top button')].map((b) => b.getAttribute('aria-label')))
    .toEqual(['Vissza', expect.stringMatching(/^Értesítések/)])
})

// Nulla olvasatlannál nem jelenik meg felesleges nagy nulla a fejlécben.
test('a végig olvasott feed nem rajzol nulla bignumot', async () => {
  const { container } = renderAt('/me/ertesitesek')
  await screen.findByText('Ma')
  await userEvent.click(screen.getByRole('button', { name: /^Értesítések, 5 olvasatlan/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Mind olvasott' }))
  expect(container.querySelector('.nf-row.unread')).toBeNull()
  expect(container.querySelector('.mz-bignum')).toBeNull()
  expect(container.querySelector('.mz-hero-sb')).toHaveTextContent('értesítés')
})

// Az olvasatlanság nem csak látó felhasználónak létezik, és a napcímkék a szerkezet (Minor 5).
test('a napcsoport <h2>-vel címkézett, az olvasatlan sor sr-only jelölést kap', async () => {
  const { container } = renderAt('/me/ertesitesek')
  const day = await screen.findByRole('heading', { name: 'Ma', level: 2 })
  const group = container.querySelector('.nf-group')
  expect(group).toHaveAttribute('role', 'group')
  expect(group).toHaveAttribute('aria-labelledby', day.id)
  expect(screen.getAllByText('Olvasatlan')[0]).toHaveClass('sr-only')
})
