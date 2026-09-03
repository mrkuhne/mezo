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
  expect(await screen.findByText('Értesítés-beállítások')).toBeInTheDocument()
  expect(container.querySelector('.nf-page')).toBeNull()
})

test('a fejléc dropdown lábléce a feedre visz', async () => {
  renderAt('/nap')
  await userEvent.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Összes értesítés ›' }))
  expect(await screen.findByText('Ma')).toBeInTheDocument()
})

// mezo-61w0 regressziós pinje: a badge eddig SOSEM tudott kialudni, mert a fában nem volt
// elérhető markAllRead hívó. Most a feed-oldal megnyitása az.
test('a fejléc olvasatlan-badge-e eltűnik, miután megnyitottuk a feedet', async () => {
  renderAt('/nap')
  const bell = await screen.findByRole('button', { name: 'Értesítések, 3 olvasatlan' })
  expect(bell.querySelector('.nap-badge')).toHaveTextContent('3')

  await userEvent.click(bell)
  await userEvent.click(screen.getByRole('menuitem', { name: 'Összes értesítés ›' }))
  await screen.findByText('Ma')

  const after = await screen.findByRole('button', { name: 'Értesítések' })
  expect(after.querySelector('.nap-badge')).toBeNull()
})

// Fix round 1 (task review, Important): a beállítások oldal `‹ Értesítések` címkéje a
// hub-csempéről érkezve hazudott, amíg a vissza gomb `navigate(-1)`-et hívott — onnan a Hub-ra
// vitt volna, nem a feedre. Most fix célponttal navigál, a `features/insights/pages/`
// testvéreinek (MemoirPage stb.) idiómája szerint.
test('a beállítások vissza gombja a feedre visz, nem a belépési pontra', async () => {
  renderAt('/me/ertesitesek/beallitasok')
  await screen.findByText('Értesítés-beállítások')
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('Ma')).toBeInTheDocument()
})

// Fix round 2 (final review, Important 1): a két vissza-csip HUROKBAN állt. A beállítások fix
// `/me/ertesitesek`-re megy (push), a feed viszont `navigate(-1)`-gyel jött vissza — a hub Értesítés
// csempéjéről indulva a feed vissza gombja a beállításokra vitt, a kettőt váltogatva örökre bent
// ragadtál, csak a tab-sáv vitt ki. A feed most fix `/me`-re megy: a létra kifelé vezet.
//
// hub-tile-reorg (mezo-o486, 2026-09-01): az Én hub Értesítés csempéje megszűnt — a belépés most
// a Beállítások csempén át a BeallitasokPage Értesítések során keresztül vezet a kapcsolókhoz.
// A lenti lánc onnantól változatlan (a kapcsolók ‹ Értesítések-je a feedre, a feed ‹ Én-je a hubra
// visz), csak a hub oldali első lépés rövidebb: a feed vissza gombja most közvetlenül a hubra ér.
test('a hub csempéjéről a létra visszavezet az Én hubra: beállítások → feed → hub', async () => {
  renderAt('/me')
  await userEvent.click(await screen.findByRole('button', { name: 'Beállítások' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Értesítések' }))

  expect(await screen.findByText('Értesítés-beállítások')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))

  // …a feeden vagyunk, és a csip már nem a lowercase `‹ vissza` default
  expect(await screen.findByText('Ma')).toBeInTheDocument()
  const back = screen.getByRole('button', { name: 'Vissza' })
  expect(back).toHaveTextContent('‹ Én')

  await userEvent.click(back)
  expect(await screen.findByRole('button', { name: 'Beállítások' })).toBeInTheDocument()
})

// Fix round 2 (final review, Minor 4): a `big` a NYITÁSKORI pillanatkép, a `sub` élő — egy végig
// olvasott feeden ez egy nagy `0`-t állított a „… értesítés" fölé. Nulla olvasatlannál nincs bignum.
test('a végig olvasott feed nem rajzol nulla bignumot', async () => {
  const { container } = renderAt('/me/ertesitesek')
  await screen.findByText('Ma')
  // az első nyitás a `markAllRead`-del mindent olvasottá tesz (a pillanatkép miatt a kiemelés
  // marad, amíg itt vagyunk) — a bignum ilyenkor még a nyitáskori 3
  expect(container.querySelector('.mz-bignum')).toHaveTextContent('3')

  // …kilépünk a beállításokba és vissza: a feed újramountol, nulla olvasatlannal
  await userEvent.click(screen.getByRole('button', { name: 'Beállítások' }))
  await screen.findByText('Értesítés-beállítások')
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))

  await screen.findByText('Ma')
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
