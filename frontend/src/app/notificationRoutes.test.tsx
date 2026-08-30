import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
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
