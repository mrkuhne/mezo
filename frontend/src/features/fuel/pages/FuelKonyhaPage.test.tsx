import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelKonyhaPage } from '@/features/fuel/pages/FuelKonyhaPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

function renderView() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/konyha']}>
        <Routes>
          <Route path="/fuel/konyha" element={<FuelKonyhaPage />} />
          <Route path="/fuel/recipes" element={<LocationProbe />} />
          <Route path="/fuel/recipes/new" element={<LocationProbe />} />
          <Route path="/fuel/recipes/muhely" element={<LocationProbe />} />
          <Route path="/fuel/kamra" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

// B1/B2 (mezo-hygp): a két rögzítő művelet a lap tetején — ezért jön ide a felhasználó.
test('a két rögzítő művelet áll elöl', () => {
  const { container } = renderView()
  const captures = container.querySelectorAll('.fkx-capture')
  expect(captures).toHaveLength(2)
  expect(captures[0]).toHaveTextContent(/Recept mentése/)
  expect(captures[1]).toHaveTextContent(/Új elem a kamrába/)
})

// Owner: a Receptek és a Kamra KÉT AJTÓ, nem két lista a főoldalon.
test('a receptek és a kamra ajtóként, nem listaként jelennek meg', async () => {
  const { container } = renderView()
  expect(container.querySelector('.fkx-list')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Receptek/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/recipes')
})

test('a Kamra ajtó a kamrába visz', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Kamra/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/kamra')
})

// Owner: a Receptműhely SAJÁT posztert kap a főoldalon.
test('a Receptműhely saját poszterként áll a főoldalon', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Receptműhely/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/recipes/muhely')
})

// B1: a recept-rögzítés a meglévő kézi szerkesztőbe visz (link-alapú recept-import NINCS).
test('a recept-rögzítés a recept-szerkesztőbe visz', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Recept mentése/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/recipes/new')
})

// B2/B3/B4: a kamra-rögzítés a meglévő import-sheetet nyitja (fotó + link arm).
test('a kamra-rögzítés az import-sheetet nyitja', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Új elem a kamrába/ }))
  expect(await screen.findByText(/Import · Fotó & Link/)).toBeInTheDocument()
})

// B14 DROP: nincs „Legutóbb érkezett" lista.
test('nincs import-előzmény lista a Konyhán', () => {
  renderView()
  expect(screen.queryByText(/Legutóbb érkezett/i)).toBeNull()
  expect(screen.queryByText(/Legutóbbi importok/i)).toBeNull()
})

// B15/B16/B17 DROP: se bevásárlólista, se készlet, se „mit főzzünk".
test('nincs bevásárlólista, készlet vagy „mit főzzünk" felület', () => {
  const { container } = renderView()
  expect(container.textContent).not.toMatch(/bevásárl|készlet|lejárat|mit főzzünk/i)
})

// B5 DROP: vonalkód-beolvasás nincs a Konyhán.
test('nincs vonalkód-beolvasás a Konyhán', () => {
  const { container } = renderView()
  expect(container.textContent).not.toMatch(/vonalkód/i)
})

// mezo-hygp: az ajtók darabszáma DARAB — a felpörgés köztes, tört értéke sosem
// kerülhet a képernyőre. (Élesben „0.58258258124…" állt a Receptek ajtaján.)
test('az ajtók száma mindig egész, sosem tört', () => {
  const { container } = renderView()
  const numerals = Array.from(container.querySelectorAll('.fkx-poster-main > strong'))
  expect(numerals.length).toBeGreaterThanOrEqual(2)
  for (const n of numerals) {
    expect(n.textContent, `tört szám az ajtón: ${n.textContent}`).toMatch(/^\d+$/)
  }
})
