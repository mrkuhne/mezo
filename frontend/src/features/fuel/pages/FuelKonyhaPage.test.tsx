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

// B1/B2 (mezo-hygp): a két rögzítő művelet az első számozott rész („Gyors felvétel") — ezért jön ide a
// felhasználó. Folyadék (mezo-n4wf5.5): a kit két csempéje (`Pair`) egy kártyában; a kártya a Kalauz horgonya.
test('a két rögzítő művelet áll elöl', () => {
  const { container } = renderView()
  const anchor = container.querySelector('[data-kalauz-anchor="konyha-felvetel"]')!
  const captures = anchor.querySelectorAll('.fo-pair > button')
  expect(captures).toHaveLength(2)
  expect(captures[0]).toHaveTextContent(/Recept mentése/)
  expect(captures[1]).toHaveTextContent(/Új elem a kamrába/)
  // a régi üveg-váz nem maradt a lapon
  expect(container.querySelector('.glass, .fkx-capture, .fkx-poster')).toBeNull()
})

// Owner (mezo-n4wf5.5): a hős az ÜRES fazék — a Receptműhely meghívója, mért szint nélkül; a támasztó tény a
// polc valódi darabszáma. A cél-sor dísz: egyik célja sem gomb.
test('a hős az üres fazék: meghívó a Műhelybe, a célok nem gombok', () => {
  const { container } = renderView()
  const hero = container.querySelector('.fo-hero')!
  expect(hero).toHaveTextContent('Receptműhely · üres fazék')
  expect(hero).toHaveTextContent('Főzzünk ki valamit.')
  expect(hero).toHaveTextContent(/A számokat a kamrád adja: \d+ tétel van a polcodon\./)
  // az üres fazék: a szaggatott vízvonal van, folyadék-szint nincs
  expect(hero.querySelector('.fx-pot path[stroke-dasharray]')).not.toBeNull()
  const goals = hero.querySelector('.fp-goals')!
  expect(goals).toHaveAttribute('aria-hidden', 'true')
  expect(goals.querySelectorAll('button, a')).toHaveLength(0)
  expect(goals).toHaveTextContent('Magas fehérje')
  expect(hero.querySelectorAll('button')).toHaveLength(1)
})

// Owner: a Receptek és a Kamra KÉT AJTÓ, nem két lista a főoldalon.
test('a receptek és a kamra ajtóként, nem listaként jelennek meg', async () => {
  const { container } = renderView()
  expect(container.querySelector('.fkx-list')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /^\d+ recept/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/recipes')
})

test('a Kamra ajtó a kamrába visz', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /tétel a polcon/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/kamra')
})

// Owner: a Receptműhely a főoldal HŐSE; a hős gombja nyitja.
test('a Receptműhelyt a hős gombja nyitja', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Műhely megnyitása' }))
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
  expect(await screen.findByText('Import · fotó és link')).toBeInTheDocument()
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

// mezo-hygp: az ajtók darabszáma DARAB — tört érték sosem kerülhet a képernyőre. (Élesben
// „0.58258258124…" állt a Receptek ajtaján; a Folyadék lapon nincs felpörgő szám, a sor a valódi darabot írja.)
test('az ajtók száma mindig egész, sosem tört', () => {
  renderView()
  expect(screen.getByRole('button', { name: /recept/ }).querySelector('strong')!.textContent).toMatch(/^\d+ recept$/)
  expect(screen.getByRole('button', { name: /tétel a polcon/ }).querySelector('strong')!.textContent).toMatch(/^\d+ tétel a polcon$/)
})

// A Kamra megoszlása: „Étel 16 · Kiegészítő 9" — minden szó egyszer, a két szám együtt a polc darabszáma.
test('a Kamra-kártya megoszlása fajtánként, minden szó egyszer', () => {
  const { container } = renderView()
  const leg = container.querySelector('.fp-shelfsplit .fx-leg')!
  const [food, supp] = [...leg.querySelectorAll('span > b')].map(b => Number(b.textContent))
  expect(leg.textContent).toMatch(/^Étel\d+Kiegészítő\d+$/)
  const total = Number(screen.getByRole('button', { name: /tétel a polcon/ }).querySelector('strong')!.textContent!.match(/\d+/)![0])
  expect(food + supp).toBe(total)
})
